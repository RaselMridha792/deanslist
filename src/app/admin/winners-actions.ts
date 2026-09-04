"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";

/**
 * Mutations for the winners manager.
 *
 * Every action re-checks the session itself. A server action is a public HTTP
 * endpoint with a generated name — being reachable only from a page behind a
 * login is not authorisation, and middleware has proven bypassable before
 * (CVE-2025-29927). EDITOR writes, OWNER deletes.
 *
 * Every action writes an AuditLog row. The winner's name is the single fact the
 * old site contradicts itself on, so when the published name changes there has
 * to be a record of who changed it.
 */

type Result = { ok: true; id?: string } | { ok: false; error: string };

/* ------------------------------------------------------------------ audit */

/**
 * Deliberately a local copy rather than an import from src/app/admin/actions.ts:
 * a "use server" module may only export async server actions, so that file's
 * audit() cannot be shared without publishing it as its own HTTP endpoint. The
 * right home is a plain src/lib/admin/audit.ts, which is outside this task's
 * file list.
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
      entityType: "Winner",
      entityId,
      before: before as never,
      after: after as never,
    },
  });
}

/** JSON-safe snapshot. Prisma's Json columns reject a live Date. */
function snapshot(w: {
  slug: string;
  name: string;
  showId: string | null;
  country: string | null;
  prizeAwarded: number | null;
  photoUrl: string | null;
  videoUrl: string | null;
  story: string | null;
  announcedAt: Date | null;
}) {
  return {
    slug: w.slug,
    name: w.name,
    showId: w.showId,
    country: w.country,
    prizeAwarded: w.prizeAwarded,
    photoUrl: w.photoUrl,
    videoUrl: w.videoUrl,
    story: w.story,
    announcedAt: w.announcedAt ? w.announcedAt.toISOString() : null,
  };
}

/* ----------------------------------------------------------------- schema */

const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalText = (max: number, label: string) =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional(),
  );

const optionalInt = z.preprocess(
  (v) => {
    if (typeof v !== "string") return undefined;
    const s = v.replace(/[$,\s]/g, "");
    if (s === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : v;
  },
  z
    .number({ invalid_type_error: "Enter a plain number, e.g. 1000" })
    .int("Whole dollars only, no cents")
    .min(0, "Cannot be negative")
    .max(100_000_000)
    .optional(),
);

const optionalDate = z.preprocess((v) => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d;
}, z.date({ invalid_type_error: "Use the date picker" }).optional());

const optionalUrl = z.preprocess(
  blankToUndefined,
  z.string().trim().max(500).url("Enter a full link starting with https://").optional(),
);

/**
 * Media paths are stored WITHOUT an extension. Picture appends .avif, .webp and
 * .jpg and lets the browser choose, so a stored "/media/x.jpg" would request
 * "/media/x.jpg.avif" and render nothing. That mistake is invisible until
 * somebody loads the public page, so it is rejected here with the reason.
 */
const IMAGE_EXTENSION = /\.(avif|webp|jpe?g|png|gif|svg)$/i;
const SITE_PATH = /^\/[A-Za-z0-9][A-Za-z0-9/_-]*$/;

const mediaPath = z
  .string()
  .trim()
  .max(200)
  .superRefine((value, ctx) => {
    if (IMAGE_EXTENSION.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Leave the file extension off. The site appends .avif, .webp and .jpg itself — store /media/winners/name, not /media/winners/name.jpg.",
      });
      return;
    }
    if (!SITE_PATH.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Use a site path such as /media/winners/pj-galloway — a leading slash, no domain, no file extension.",
      });
    }
  });

const optionalMediaPath = z.preprocess(blankToUndefined, mediaPath.optional());

const optionalSlug = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .toLowerCase()
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens only")
    .optional(),
);

const winnerSchema = z.object({
  name: z.string().trim().min(1, "A name is required").max(120),
  slug: optionalSlug,
  showId: optionalText(40, "Show"),
  country: optionalText(80, "Country"),
  prizeAwarded: optionalInt,
  photoUrl: optionalMediaPath,
  videoUrl: optionalUrl,
  story: optionalText(8000, "Story"),
  announcedAt: optionalDate,
});

const LABELS: Record<string, string> = {
  name: "Name",
  slug: "URL slug",
  showId: "Show",
  country: "Country",
  prizeAwarded: "Prize awarded",
  photoUrl: "Portrait path",
  videoUrl: "Performance link",
  story: "Story",
  announcedAt: "Announced",
};

function firstError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Check the form and try again.";
  const label = LABELS[String(issue.path[0] ?? "")];
  return label ? `${label} — ${issue.message}` : issue.message;
}

/* ------------------------------------------------------------------- slug */

/** Diacritics folded, punctuation dropped, runs of separators collapsed. */
function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

type SlugResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * The slug is the public URL, so a clash is reported by name rather than quietly
 * suffixed: two winners resolving to the same address is a data problem the team
 * should see, not something to paper over with "-2".
 */
async function resolveSlug(
  desired: string | undefined,
  name: string,
  excludeId?: string,
): Promise<SlugResult> {
  const slug = desired ?? slugify(name);
  if (!slug) {
    return {
      ok: false,
      error:
        "That name does not produce a usable web address. Type a URL slug manually, e.g. crown-the-sound-winner.",
    };
  }

  const clash = await prisma.winner.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (clash && clash.id !== excludeId) {
    return {
      ok: false,
      error: `The address /winners/${slug} already belongs to ${clash.name}. Set a different URL slug.`,
    };
  }
  return { ok: true, slug };
}

function prismaMessage(e: unknown, fallback: string): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "That URL slug is already taken. Choose another.";
    if (e.code === "P2003") return "That show no longer exists. Reload the page and pick again.";
    if (e.code === "P2025") return "That winner no longer exists. It may have been deleted.";
  }
  console.error("[winners-actions]", e);
  return fallback;
}

/** Every public surface a winner appears on. */
function revalidateWinners() {
  revalidatePath("/");
  revalidatePath("/winners");
  revalidatePath("/winners/[slug]", "page");
  revalidatePath("/admin/winners");
}

/* ----------------------------------------------------------------- create */

export async function createWinner(formData: FormData): Promise<Result> {
  const user = await requireRole("EDITOR");

  const parsed = winnerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const slug = await resolveSlug(d.slug, d.name);
  if (!slug.ok) return { ok: false, error: slug.error };

  try {
    const winner = await prisma.winner.create({
      data: {
        slug: slug.slug,
        name: d.name,
        showId: d.showId ?? null,
        country: d.country ?? null,
        prizeAwarded: d.prizeAwarded ?? null,
        photoUrl: d.photoUrl ?? null,
        videoUrl: d.videoUrl ?? null,
        story: d.story ?? null,
        announcedAt: d.announcedAt ?? null,
      },
    });

    await audit(user, "winner.create", winner.id, null, snapshot(winner));
    revalidateWinners();
    return { ok: true, id: winner.id };
  } catch (e) {
    return { ok: false, error: prismaMessage(e, "Could not save this winner.") };
  }
}

/* ----------------------------------------------------------------- update */

export async function updateWinner(formData: FormData): Promise<Result> {
  const user = await requireRole("EDITOR");

  const raw = Object.fromEntries(formData.entries());
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return { ok: false, error: "Invalid request." };

  const parsed = winnerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const before = await prisma.winner.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That winner no longer exists." };

  // A cleared slug field falls back to the name, exactly as the create form
  // does. An existing slug is otherwise left as typed: the public URL may
  // already be linked from elsewhere, and correcting a spelling should not
  // silently 404 the page.
  const slug = await resolveSlug(d.slug, d.name, id);
  if (!slug.ok) return { ok: false, error: slug.error };

  try {
    const after = await prisma.winner.update({
      where: { id },
      data: {
        slug: slug.slug,
        name: d.name,
        showId: d.showId ?? null,
        country: d.country ?? null,
        prizeAwarded: d.prizeAwarded ?? null,
        photoUrl: d.photoUrl ?? null,
        videoUrl: d.videoUrl ?? null,
        story: d.story ?? null,
        announcedAt: d.announcedAt ?? null,
      },
    });

    await audit(user, "winner.update", id, snapshot(before), snapshot(after));
    revalidateWinners();
    revalidatePath(`/admin/winners/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: prismaMessage(e, "Could not save this winner.") };
  }
}

/* ----------------------------------------------------------------- delete */

/** OWNER only. Unpublishing a winner's page is not an editor's call. */
export async function deleteWinner(id: string): Promise<Result> {
  const user = await requireRole("OWNER");
  if (typeof id !== "string" || !id) return { ok: false, error: "Invalid request." };

  const before = await prisma.winner.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That winner no longer exists." };

  try {
    await prisma.winner.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: prismaMessage(e, "Could not delete this winner.") };
  }

  await audit(user, "winner.delete", id, snapshot(before), null);
  revalidateWinners();
  return { ok: true };
}
