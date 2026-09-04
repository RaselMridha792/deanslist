"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";
import { formatStat } from "@/lib/queries";

/**
 * Mutations for the three content managers the client owns outright:
 * sponsors, the site statistics band, and the editable page sections behind
 * /about and /rules.
 *
 * Same two rules as src/app/admin/actions.ts, for the same reasons:
 *
 *   1. Every action re-checks the session itself. A server action is a public
 *      HTTP endpoint with a generated name; being reachable only from a page
 *      behind a login is not authorisation, and middleware has proven bypassable
 *      (CVE-2025-29927).
 *   2. Every mutation writes an AuditLog row. A role that is never recorded is
 *      decoration.
 *
 * EDITOR creates and updates. OWNER deletes.
 */

type Result = { ok: true; id?: string } | { ok: false; error: string };

/* ----------------------------------------------------------------- helpers */

async function audit(
  user: SessionUser,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userEmail: user.email,
      action,
      entityType,
      entityId,
      before: before as never,
      after: after as never,
    },
  });
}

/** Empty string is not a value. A blank optional input means "unset", not "". */
function text(fd: FormData, name: string): string | undefined {
  const v = fd.get(name);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

function flag(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

function num(fd: FormData, name: string, fallback = 0): number {
  const raw = text(fd, name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the highlighted fields.";
}

/** Prisma unique-constraint violation. Surfaced as a sentence, not a stack trace. */
function isDuplicate(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * A link field accepts a full https:// URL or a site-relative path, because
 * sponsor logos may live in /public/media rather than on the sponsor's CDN.
 */
function linkField(label: string, max = 500) {
  return z
    .string()
    .max(max, `${label} is too long`)
    .refine(
      (v) => /^https?:\/\//i.test(v) || v.startsWith("/"),
      `${label} must start with https:// or with /`,
    );
}

/**
 * Content changes affect the homepage sponsor strip, the sponsors page, and the
 * two pages whose copy lives in PageSection. Revalidating all four on every save
 * is cheaper than reasoning about which one moved.
 */
function revalidatePublic() {
  revalidatePath("/");
  revalidatePath("/sponsors");
  revalidatePath("/rules");
  revalidatePath("/about");
}

/* ---------------------------------------------------------------- sponsors */

/**
 * Not exported: a "use server" module may only export async functions. The tier
 * copy shown on /sponsors lives in SPONSOR_TIERS in src/content/site.ts; these
 * are the stored values for the same three tiers, lowercased.
 */
const SPONSOR_TIER_VALUES = ["headline", "supporting", "partner"] as const;

const sponsorSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, "Sponsor name is required").max(120),
  slug: z
    .string()
    .max(80)
    .regex(SLUG_RE, "Slug: lowercase letters, numbers and single dashes only")
    .optional(),
  logoUrl: linkField("Logo URL").optional(),
  url: z
    .string()
    .max(500)
    .url("Website must be a full URL, including https://")
    .optional(),
  tier: z
    .enum(SPONSOR_TIER_VALUES, { errorMap: () => ({ message: "Pick a tier" }) })
    .optional(),
  blurb: z.string().max(400, "Keep the blurb under 400 characters").optional(),
  active: z.boolean(),
  sortOrder: z.number().int("Order must be a whole number").min(0).max(9999),
});

type SponsorFields = {
  name: string;
  slug: string;
  logoUrl: string | null;
  url: string | null;
  tier: string | null;
  blurb: string | null;
  active: boolean;
  sortOrder: number;
};

/** Audit snapshots carry only editable fields — no Date objects into a Json column. */
function sponsorSnapshot(s: SponsorFields): SponsorFields {
  return {
    name: s.name,
    slug: s.slug,
    logoUrl: s.logoUrl,
    url: s.url,
    tier: s.tier,
    blurb: s.blurb,
    active: s.active,
    sortOrder: s.sortOrder,
  };
}

export async function saveSponsor(formData: FormData): Promise<Result> {
  const user = await requireRole("EDITOR");

  const parsed = sponsorSchema.safeParse({
    id: text(formData, "id"),
    name: text(formData, "name") ?? "",
    slug: text(formData, "slug"),
    logoUrl: text(formData, "logoUrl"),
    url: text(formData, "url"),
    tier: text(formData, "tier"),
    blurb: text(formData, "blurb"),
    active: flag(formData, "active"),
    sortOrder: num(formData, "sortOrder"),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const slug = d.slug ?? slugify(d.name);
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: "Could not build a slug from that name. Enter one manually." };
  }

  const data: SponsorFields = {
    name: d.name,
    slug,
    logoUrl: d.logoUrl ?? null,
    url: d.url ?? null,
    tier: d.tier ?? null,
    blurb: d.blurb ?? null,
    active: d.active,
    sortOrder: d.sortOrder,
  };

  try {
    if (d.id) {
      const before = await prisma.sponsor.findUnique({ where: { id: d.id } });
      if (!before) return { ok: false, error: "That sponsor no longer exists." };

      const after = await prisma.sponsor.update({ where: { id: d.id }, data });
      await audit(
        user,
        "sponsor.update",
        "Sponsor",
        after.id,
        sponsorSnapshot(before),
        sponsorSnapshot(after),
      );
      revalidatePublic();
      revalidatePath("/admin/content/sponsors");
      return { ok: true, id: after.id };
    }

    const created = await prisma.sponsor.create({ data });
    await audit(user, "sponsor.create", "Sponsor", created.id, null, sponsorSnapshot(created));
    revalidatePublic();
    revalidatePath("/admin/content/sponsors");
    return { ok: true, id: created.id };
  } catch (err) {
    if (isDuplicate(err)) {
      return { ok: false, error: `Another sponsor already uses the slug "${slug}".` };
    }
    throw err;
  }
}

export async function deleteSponsor(id: string): Promise<Result> {
  const user = await requireRole("OWNER");
  if (!id) return { ok: false, error: "Invalid request" };

  const before = await prisma.sponsor.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That sponsor no longer exists." };

  await prisma.sponsor.delete({ where: { id } });
  await audit(user, "sponsor.delete", "Sponsor", id, sponsorSnapshot(before), null);

  revalidatePublic();
  revalidatePath("/admin/content/sponsors");
  return { ok: true };
}

/* ------------------------------------------------------------------- stats */

const statSchema = z.object({
  id: z.string().min(1).optional(),
  key: z
    .string()
    .min(1, "Key is required")
    .max(60)
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "Key: lowercase letters, numbers and underscores"),
  label: z.string().min(1, "Label is required").max(80),
  // Prisma Int is 32-bit. Cap well below the limit rather than let the database
  // reject it after the form has already been accepted.
  value: z
    .number({ invalid_type_error: "Value must be a number" })
    .int("Value must be a whole number")
    .min(0, "Value cannot be negative")
    .max(2_000_000_000, "That value is larger than the database column allows"),
  prefix: z.string().max(4, "Prefix is at most 4 characters").optional(),
  suffix: z.string().max(4, "Suffix is at most 4 characters").optional(),
  displayAs: z.string().max(40).optional(),
  verified: z.boolean(),
  confirmVerified: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int("Order must be a whole number").min(0).max(9999),
});

type StatFields = {
  key: string;
  label: string;
  value: number;
  prefix: string | null;
  suffix: string | null;
  displayAs: string | null;
  verified: boolean;
  active: boolean;
  sortOrder: number;
};

function statSnapshot(s: StatFields): StatFields {
  return {
    key: s.key,
    label: s.label,
    value: s.value,
    prefix: s.prefix,
    suffix: s.suffix,
    displayAs: s.displayAs,
    verified: s.verified,
    active: s.active,
    sortOrder: s.sortOrder,
  };
}

/**
 * Renders a candidate figure exactly as the public site will render it, by
 * calling the same formatStat() the StatsBand and the sponsors page use.
 *
 * It runs on the server rather than in the browser on purpose: formatStat lives
 * in src/lib/queries.ts alongside the Prisma client, so it cannot be imported
 * into a client bundle. Reimplementing the rule in the editor would let the
 * preview drift from the thing it is previewing, which is the exact failure the
 * old site shipped (".7Mil+", a bare "K"). One debounced round trip is cheaper
 * than a second copy of the rule.
 */
export async function previewStat(input: {
  value: number;
  prefix?: string;
  suffix?: string;
}): Promise<string> {
  await requireRole("EDITOR");

  const value =
    typeof input.value === "number" && Number.isFinite(input.value)
      ? Math.max(0, Math.trunc(input.value))
      : 0;

  return formatStat({
    key: "preview",
    label: "preview",
    value,
    prefix: input.prefix?.slice(0, 4) || undefined,
    suffix: input.suffix?.slice(0, 4) || undefined,
  });
}

export async function saveStat(formData: FormData): Promise<Result> {
  const user = await requireRole("EDITOR");

  const parsed = statSchema.safeParse({
    id: text(formData, "id"),
    key: text(formData, "key") ?? "",
    label: text(formData, "label") ?? "",
    // No fallback: a blank value must fail validation, not silently save as 0.
    value: num(formData, "value", Number.NaN),
    prefix: text(formData, "prefix"),
    suffix: text(formData, "suffix"),
    displayAs: text(formData, "displayAs"),
    verified: flag(formData, "verified"),
    confirmVerified: flag(formData, "confirmVerified"),
    active: flag(formData, "active"),
    sortOrder: num(formData, "sortOrder"),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const previous = d.id ? await prisma.siteStat.findUnique({ where: { id: d.id } }) : null;
  if (d.id && !previous) return { ok: false, error: "That statistic no longer exists." };
  const wasVerified = previous?.verified ?? false;

  /**
   * The gate, enforced server-side and not only in the form.
   *
   * Marking a figure verified is what puts it in front of visitors and
   * prospective sponsors — getStats() returns verified rows and nothing else.
   * The confirmation has to be an explicit act, and a checkbox that only the
   * browser enforces is not one.
   */
  if (d.verified && !wasVerified && !d.confirmVerified) {
    return {
      ok: false,
      error:
        "Confirm the figure first. Marking a statistic verified publishes it as a claim on the public site.",
    };
  }

  const data: StatFields = {
    key: d.key,
    label: d.label,
    value: d.value,
    prefix: d.prefix ?? null,
    suffix: d.suffix ?? null,
    displayAs: d.displayAs ?? null,
    verified: d.verified,
    active: d.active,
    sortOrder: d.sortOrder,
  };

  try {
    const row = previous
      ? await prisma.siteStat.update({ where: { id: previous.id }, data })
      : await prisma.siteStat.create({ data });

    await audit(
      user,
      previous ? "sitestat.update" : "sitestat.create",
      "SiteStat",
      row.id,
      previous ? statSnapshot(previous) : null,
      statSnapshot(row),
    );

    // A second, dedicated row when the public gate moves. "Who put the 700K
    // figure on the site" needs a single greppable answer, not a diff to read.
    if (d.verified !== wasVerified) {
      await audit(
        user,
        d.verified ? "sitestat.verify" : "sitestat.unverify",
        "SiteStat",
        row.id,
        { verified: wasVerified },
        { verified: d.verified, key: row.key, label: row.label, value: row.value },
      );
    }

    revalidatePublic();
    revalidatePath("/admin/content/stats");
    return { ok: true, id: row.id };
  } catch (err) {
    if (isDuplicate(err)) {
      return { ok: false, error: `Another statistic already uses the key "${d.key}".` };
    }
    throw err;
  }
}

/**
 * One-click take-down. Deliberately asymmetric with publishing: removing an
 * unconfirmed claim from the public site is always the safe direction and should
 * never be gated behind a form, while putting one up requires the confirmation
 * above.
 */
export async function unverifyStat(id: string): Promise<Result> {
  const user = await requireRole("EDITOR");
  if (!id) return { ok: false, error: "Invalid request" };

  const before = await prisma.siteStat.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That statistic no longer exists." };
  if (!before.verified) return { ok: true, id };

  await prisma.siteStat.update({ where: { id }, data: { verified: false } });
  await audit(
    user,
    "sitestat.unverify",
    "SiteStat",
    id,
    { verified: true },
    { verified: false, key: before.key, label: before.label, value: before.value },
  );

  revalidatePublic();
  revalidatePath("/admin/content/stats");
  return { ok: true, id };
}

export async function deleteStat(id: string): Promise<Result> {
  const user = await requireRole("OWNER");
  if (!id) return { ok: false, error: "Invalid request" };

  const before = await prisma.siteStat.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That statistic no longer exists." };

  await prisma.siteStat.delete({ where: { id } });
  await audit(user, "sitestat.delete", "SiteStat", id, statSnapshot(before), null);

  revalidatePublic();
  revalidatePath("/admin/content/stats");
  return { ok: true };
}

/* ---------------------------------------------------------------- sections */

/**
 * Constrained to the pages that actually have a slot for editable copy. Free
 * text here would silently create sections on a page that never reads them,
 * which looks identical to a bug.
 */
const SECTION_PAGES = ["about", "rules", "sponsors", "contact"] as const;

const sectionSchema = z.object({
  id: z.string().min(1).optional(),
  page: z.enum(SECTION_PAGES, { errorMap: () => ({ message: "Pick a page" }) }),
  key: z
    .string()
    .min(1, "Key is required")
    .max(60)
    .regex(SLUG_RE, "Key: lowercase letters, numbers and single dashes only"),
  heading: z.string().max(160, "Heading is too long").optional(),
  body: z.string().min(1, "Body is required").max(20_000, "Body is too long"),
  sortOrder: z.number().int("Order must be a whole number").min(0).max(9999),
  published: z.boolean(),
});

type SectionFields = {
  page: string;
  key: string;
  heading: string | null;
  body: string;
  sortOrder: number;
  published: boolean;
};

/**
 * The body is summarised rather than copied into the audit log. Contest rules
 * run to thousands of characters and duplicating every revision into a table
 * nobody prunes buys nothing — the length and the publish flag are what anyone
 * asking "who changed the rules page" needs.
 */
function sectionSnapshot(s: SectionFields) {
  return {
    page: s.page,
    key: s.key,
    heading: s.heading,
    bodyLength: s.body.length,
    sortOrder: s.sortOrder,
    published: s.published,
  };
}

export async function saveSection(formData: FormData): Promise<Result> {
  const user = await requireRole("EDITOR");

  const parsed = sectionSchema.safeParse({
    id: text(formData, "id"),
    page: text(formData, "page"),
    key: text(formData, "key") ?? "",
    heading: text(formData, "heading"),
    body: (formData.get("body") as string | null)?.trim() ?? "",
    sortOrder: num(formData, "sortOrder"),
    published: flag(formData, "published"),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const data: SectionFields = {
    page: d.page,
    key: d.key,
    heading: d.heading ?? null,
    body: d.body,
    sortOrder: d.sortOrder,
    published: d.published,
  };

  try {
    if (d.id) {
      const before = await prisma.pageSection.findUnique({ where: { id: d.id } });
      if (!before) return { ok: false, error: "That section no longer exists." };

      const after = await prisma.pageSection.update({ where: { id: d.id }, data });
      await audit(
        user,
        "pagesection.update",
        "PageSection",
        after.id,
        sectionSnapshot(before),
        sectionSnapshot(after),
      );
      revalidatePublic();
      revalidatePath("/admin/content/sections");
      return { ok: true, id: after.id };
    }

    const created = await prisma.pageSection.create({ data });
    await audit(
      user,
      "pagesection.create",
      "PageSection",
      created.id,
      null,
      sectionSnapshot(created),
    );
    revalidatePublic();
    revalidatePath("/admin/content/sections");
    return { ok: true, id: created.id };
  } catch (err) {
    if (isDuplicate(err)) {
      return {
        ok: false,
        error: `The /${d.page} page already has a section keyed "${d.key}". Edit that one instead.`,
      };
    }
    throw err;
  }
}

export async function deleteSection(id: string): Promise<Result> {
  const user = await requireRole("OWNER");
  if (!id) return { ok: false, error: "Invalid request" };

  const before = await prisma.pageSection.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That section no longer exists." };

  await prisma.pageSection.delete({ where: { id } });
  await audit(user, "pagesection.delete", "PageSection", id, sectionSnapshot(before), null);

  revalidatePublic();
  revalidatePath("/admin/content/sections");
  return { ok: true };
}
