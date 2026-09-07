"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";
import type { ActionResult } from "@/components/admin/crud";

/**
 * Mutations for campaigns.
 *
 * Same two rules as every other actions module here, for the same reasons:
 *
 *   every action re-checks the session itself. A server action is a public HTTP
 *   endpoint with a generated name; reachable-only-from-a-page-behind-a-login
 *   is not authorisation, and middleware has been bypassable before
 *   (CVE-2025-29927). EDITOR writes, OWNER deletes.
 *
 *   every action writes an AuditLog row. Publishing a campaign puts a prize
 *   claim on a public page, so "who published this, and when" has to have an
 *   answer that is not somebody's memory.
 */

async function audit(
  user: SessionUser,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userEmail: user.email,
      action,
      entityType: "Promotion",
      entityId,
      before: before as never,
      after: after as never,
    },
  });
}

/**
 * A slug is a URL, so it is generated from the title rather than typed, and
 * only on create. Changing it later would break every link already shared to
 * the campaign, including the one in a running ad.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const optional = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim())
    .transform((v) => (v.length > 0 ? v : null))
    .nullable()
    .optional();

const schema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "A title is required").max(120),
  kicker: optional(80),
  tagline: optional(120),
  summary: z.string().min(1, "A summary is required").max(400),
  body: optional(6000),
  steps: optional(6000),
  prizeTitle: optional(160),
  prizeNote: optional(1000),
  hashtags: optional(300),
  imagePath: optional(400),
  ctaLabel: optional(60),
  ctaHref: optional(400),
  status: z.enum(["DRAFT", "RUNNING", "ENDED"]),
  showId: optional(40),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

function read(fd: FormData) {
  return schema.safeParse({
    id: (fd.get("id") as string) || undefined,
    title: String(fd.get("title") ?? ""),
    kicker: String(fd.get("kicker") ?? ""),
    tagline: String(fd.get("tagline") ?? ""),
    summary: String(fd.get("summary") ?? ""),
    body: String(fd.get("body") ?? ""),
    steps: String(fd.get("steps") ?? ""),
    prizeTitle: String(fd.get("prizeTitle") ?? ""),
    prizeNote: String(fd.get("prizeNote") ?? ""),
    hashtags: String(fd.get("hashtags") ?? ""),
    imagePath: String(fd.get("imagePath") ?? ""),
    ctaLabel: String(fd.get("ctaLabel") ?? ""),
    ctaHref: String(fd.get("ctaHref") ?? ""),
    status: String(fd.get("status") ?? "DRAFT"),
    showId: String(fd.get("showId") ?? ""),
    sortOrder: String(fd.get("sortOrder") ?? "0"),
  });
}

/**
 * A CTA has to be a path on this site or an http(s) URL.
 *
 * Left unchecked, `ctaHref` is a free-text field that renders straight into an
 * href on a public page, which is a stored `javascript:` payload waiting for an
 * editor account to be compromised. Rejecting anything that is not a path or a
 * web URL closes it without limiting anything a campaign actually needs.
 */
function badHref(href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("/")) return null;
  if (/^https?:\/\//i.test(href)) return null;
  return "The link must start with / for a page on this site, or with https:// for anywhere else.";
}

function refresh(slug?: string) {
  revalidatePath("/admin/campaigns-public");
  revalidatePath("/campaigns");
  if (slug) revalidatePath(`/campaigns/${slug}`);
}

export async function savePromotion(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("EDITOR");
  const parsed = read(fd);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid campaign",
    };
  }
  const { id, showId, ...data } = parsed.data;

  const hrefError = badHref(data.ctaHref);
  if (hrefError) return { ok: false, error: hrefError };

  // A CTA is a label and a destination. One without the other renders either a
  // button that goes nowhere or a link with no words in it.
  if (Boolean(data.ctaLabel) !== Boolean(data.ctaHref)) {
    return {
      ok: false,
      error: "A button needs both a label and a link, or neither.",
    };
  }

  const values = { ...data, showId: showId || null };

  try {
    if (id) {
      const before = await prisma.promotion.findUnique({ where: { id } });
      if (!before)
        return { ok: false, error: "That campaign no longer exists." };

      const after = await prisma.promotion.update({
        where: { id },
        data: values,
      });
      await audit(user, "promotion.update", id, before, after);
      refresh(after.slug);
      return { ok: true };
    }

    // Slug collisions are resolved rather than reported. Two campaigns can
    // legitimately share a title across seasons, and "that name is taken" is
    // not a problem an editor should have to solve.
    const base = slugify(values.title) || "campaign";
    let slug = base;
    for (
      let n = 2;
      await prisma.promotion.findUnique({ where: { slug } });
      n++
    ) {
      slug = `${base}-${n}`;
    }

    const created = await prisma.promotion.create({
      data: { ...values, slug },
    });
    await audit(user, "promotion.create", created.id, null, created);
    refresh(created.slug);
    return { ok: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        ok: false,
        error: "A campaign with that address already exists.",
      };
    }
    throw err;
  }
}

/**
 * OWNER only, and a hard delete.
 *
 * A campaign that has run is usually better ENDED than removed: the page stays
 * as evidence the contest was real and paid out, and the link in a post from
 * last week keeps working. Delete is for a draft that was a mistake.
 */
export async function deletePromotion(id: string): Promise<ActionResult> {
  const user = await requireRole("OWNER");
  const before = await prisma.promotion.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That campaign no longer exists." };

  await prisma.promotion.delete({ where: { id } });
  await audit(user, "promotion.delete", id, before, null);
  refresh(before.slug);
  return { ok: true };
}

/** The one-click control on the index, so status changes do not need the form. */
export async function setPromotionStatus(
  id: string,
  status: "DRAFT" | "RUNNING" | "ENDED",
): Promise<ActionResult> {
  const user = await requireRole("EDITOR");
  const before = await prisma.promotion.findUnique({
    where: { id },
    select: { status: true, slug: true },
  });
  if (!before) return { ok: false, error: "That campaign no longer exists." };

  await prisma.promotion.update({ where: { id }, data: { status } });
  await audit(user, "promotion.status", id, before, { status });
  refresh(before.slug);
  return { ok: true };
}
