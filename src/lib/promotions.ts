import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * Campaigns: the contests and calls for entries the client runs alongside the
 * shows, each with a public page.
 *
 * The dashboard calls these Campaigns because that is the client's word. The
 * model is Promotion because `Campaign` in this schema is already an email
 * send. See the note on the model in prisma/schema.prisma.
 */

export type PromotionStep = { heading: string; body: string[] };

export type Promotion = {
  slug: string;
  title: string;
  kicker: string | null;
  tagline: string | null;
  summary: string;
  body: string[];
  steps: PromotionStep[];
  prizeTitle: string | null;
  prizeNote: string | null;
  hashtags: string[];
  imagePath: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  status: "DRAFT" | "RUNNING" | "ENDED";
  showSlug: string | null;
  showTitle: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

/**
 * Steps are one text field, blank-line separated, first line of each is its
 * heading. Same shape PageSection uses for /rules, so an editor learns it once.
 *
 * A step with only a heading is legitimate — "Show up live" needs no
 * explanation — so an empty body is not treated as a malformed step.
 */
export function parseSteps(raw: string | null): PromotionStep[] {
  if (!raw) return [];
  return raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [heading, ...rest] = block.split("\n");
      return {
        heading: heading.trim(),
        body: rest.map((l) => l.trim().replace(/^[-•]\s*/, "")).filter(Boolean),
      };
    });
}

/** Hashtags are typed however the client types them. Normalised on the way out. */
function parseHashtags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((t) => `#${t}`);
}

type Row = Awaited<ReturnType<typeof prisma.promotion.findMany>>[number] & {
  show?: { slug: string; title: string } | null;
};

function shape(row: Row): Promotion {
  return {
    slug: row.slug,
    title: row.title,
    kicker: row.kicker,
    tagline: row.tagline,
    summary: row.summary,
    body: (row.body ?? "")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    steps: parseSteps(row.steps),
    prizeTitle: row.prizeTitle,
    prizeNote: row.prizeNote,
    hashtags: parseHashtags(row.hashtags),
    imagePath: row.imagePath,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    status: row.status,
    showSlug: row.show?.slug ?? null,
    showTitle: row.show?.title ?? null,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
  };
}

/**
 * Same split the rest of the data layer uses: an unreachable database is a
 * fault, so it warns and serves nothing in development and rethrows in
 * production. Serving an empty list in production would render a campaigns page
 * that says there are no campaigns, which is a lie told confidently.
 */
async function safe<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (env.NODE_ENV === "production") throw err;
    console.warn(
      `[${label}] Database unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
    return fallback;
  }
}

/**
 * Everything the public may see, running first.
 *
 * DRAFT never leaves the dashboard. ENDED stays visible on purpose: a contest
 * that finished last week is proof the contest is real and pays out, which is
 * exactly what a visitor arriving from an ad is deciding.
 */
export async function getPromotions(): Promise<Promotion[]> {
  return safe(
    "promotions",
    async () => {
      const rows = await prisma.promotion.findMany({
        where: { status: { in: ["RUNNING", "ENDED"] } },
        include: { show: { select: { slug: true, title: true } } },
        orderBy: [
          { status: "asc" },
          { sortOrder: "asc" },
          { createdAt: "desc" },
        ],
      });
      // status asc puts ENDED before RUNNING alphabetically, which is backwards.
      const rank = { RUNNING: 0, ENDED: 1, DRAFT: 2 } as const;
      return rows
        .sort(
          (a, b) =>
            rank[a.status] - rank[b.status] ||
            a.sortOrder - b.sortOrder ||
            b.createdAt.getTime() - a.createdAt.getTime(),
        )
        .map(shape);
    },
    [],
  );
}

export async function getPromotion(slug: string): Promise<Promotion | null> {
  return safe(
    "promotion",
    async () => {
      const row = await prisma.promotion.findFirst({
        where: { slug, status: { in: ["RUNNING", "ENDED"] } },
        include: { show: { select: { slug: true, title: true } } },
      });
      return row ? shape(row) : null;
    },
    null,
  );
}

/** Slugs for the sitemap. */
export async function getPromotionSlugs(): Promise<string[]> {
  return safe(
    "promotion-slugs",
    async () => {
      const rows = await prisma.promotion.findMany({
        where: { status: { in: ["RUNNING", "ENDED"] } },
        select: { slug: true },
      });
      return rows.map((r) => r.slug);
    },
    [],
  );
}
