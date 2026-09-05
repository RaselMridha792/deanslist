import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  SHOWS,
  WINNERS,
  EPISODES,
  STATS,
  GALLERY,
  type ShowSeed,
  type WinnerSeed,
} from "@/content/site";

/**
 * Read layer for the public site.
 *
 * Two distinct fallbacks, deliberately not conflated:
 *
 *   database unreachable — a real fault. In development it warns and serves the
 *     seed content so work continues without Postgres running; in production it
 *     rethrows, because silently serving stale copy from a broken deployment is
 *     worse than an error page.
 *
 *   database reachable but empty — expected before the first seed. Serves the
 *     content module in every environment, so the site is never blank and the
 *     dashboard takes over the moment a row exists.
 */

let warned = false;

async function safeDb<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    if (env.NODE_ENV === "production") throw err;
    if (!warned) {
      warned = true;
      console.warn(
        `\n[queries] Database unreachable — serving seed content from src/content/site.ts.` +
          `\n[queries] Set DATABASE_URL and run \`npm run db:push && npm run db:seed\` to use real data.\n`,
      );
    }
    console.warn(`[queries] ${label}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/* ------------------------------------------------------------------ types */

export type Show = {
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  entryDeadline: string | null;
  startsAt: string | null;
  cadence: string | null;
  prizeAmount: number | null;
  status: string;
  heroVideo: string | null;
  heroPoster: string | null;
  keyArt: string | null;
  mechanic?: { name: string; body: string }[];
  pitch?: string[];
  pending?: string[];
};

export type Winner = {
  slug: string;
  name: string;
  showSlug: string | null;
  showTitle: string | null;
  prizeAwarded: number | null;
  story: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  announcedAt: string | null;
};

export type Episode = { videoId: string; title: string; showSlug: string | null };

export type Stat = {
  key: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
};

/* --------------------------------------------------------------- adapters */

const fromSeedShow = (s: ShowSeed): Show => ({ ...s });

const fromSeedWinner = (w: WinnerSeed): Winner => ({
  slug: w.slug,
  name: w.name,
  showSlug: w.showSlug,
  showTitle: SHOWS.find((s) => s.slug === w.showSlug)?.title ?? null,
  prizeAwarded: w.prizeAwarded,
  story: w.story,
  photoUrl: w.photoUrl,
  videoUrl: w.videoUrl,
  announcedAt: w.announcedAt,
});

/* ---------------------------------------------------------------- queries */

export async function getShows(): Promise<Show[]> {
  const rows = await safeDb("getShows", () =>
    prisma.show.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: [{ status: "asc" }, { startsAt: "desc" }],
    }),
  );

  if (!rows || rows.length === 0) return SHOWS.map(fromSeedShow);

  return rows.map((r) => {
    // Editorial fields the schema has no column for: the Freeze/Pass mechanic,
    // the show's pitch copy, and the cadence line. They live in the content
    // module and are matched back on by slug.
    //
    // Without this a seeded show renders without its mechanic section and its
    // pitch — the page looks correct against the design today and quietly
    // empties out the moment the client seeds the database. If these ever
    // become client-editable they want real columns; until then this keeps the
    // two sources from disagreeing.
    const seed = SHOWS.find((s) => s.slug === r.slug);

    return {
      slug: r.slug,
      title: r.title,
      tagline: r.tagline,
      description: r.description,
      entryDeadline: r.entryDeadline?.toISOString() ?? null,
      startsAt: r.startsAt?.toISOString() ?? null,
      cadence: seed?.cadence ?? null,
      prizeAmount: r.prizeAmount,
      status: r.status,
      heroVideo: r.trailerUrl ?? seed?.heroVideo ?? null,
      heroPoster: r.heroImageUrl ?? seed?.heroPoster ?? null,
      keyArt: r.heroImageUrl ?? seed?.keyArt ?? null,
      mechanic: seed?.mechanic,
      pitch: seed?.pitch,
      pending: seed?.pending,
    };
  });
}

export async function getShow(slug: string): Promise<Show | null> {
  const all = await getShows();
  return all.find((s) => s.slug === slug) ?? null;
}

/** The show the homepage hero and the entry funnel point at. */
export async function getCurrentShow(): Promise<Show | null> {
  const all = await getShows();
  return (
    all.find((s) => s.status === "LIVE") ??
    all.find((s) => s.status === "OPEN") ??
    all[0] ??
    null
  );
}

export async function getWinners(): Promise<Winner[]> {
  const rows = await safeDb("getWinners", () =>
    prisma.winner.findMany({
      orderBy: { announcedAt: "desc" },
      include: { show: { select: { slug: true, title: true } } },
    }),
  );

  if (!rows || rows.length === 0) return WINNERS.map(fromSeedWinner);

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    showSlug: r.show?.slug ?? null,
    showTitle: r.show?.title ?? null,
    prizeAwarded: r.prizeAwarded,
    story: r.story,
    photoUrl: r.photoUrl,
    videoUrl: r.videoUrl,
    announcedAt: r.announcedAt?.toISOString() ?? null,
  }));
}

export async function getWinner(slug: string): Promise<Winner | null> {
  const all = await getWinners();
  return all.find((w) => w.slug === slug) ?? null;
}

export async function getLatestWinner(): Promise<Winner | null> {
  return (await getWinners())[0] ?? null;
}

export async function getEpisodes(showSlug?: string): Promise<Episode[]> {
  const rows = await safeDb("getEpisodes", () =>
    prisma.episode.findMany({
      orderBy: { airedAt: "desc" },
      include: { show: { select: { slug: true } } },
    }),
  );

  const list: Episode[] =
    !rows || rows.length === 0
      ? EPISODES.map((e) => ({ videoId: e.videoId, title: e.title, showSlug: e.showSlug }))
      : rows.map((r) => ({
          videoId: extractYouTubeId(r.videoUrl) ?? "",
          title: r.title,
          showSlug: r.show?.slug ?? null,
        }));

  const usable = list.filter((e) => e.videoId);
  return showSlug ? usable.filter((e) => e.showSlug === showSlug) : usable;
}

/**
 * Only verified figures are ever returned. An unverified number must not reach
 * the public site — that is the whole reason SiteStat carries the flag.
 */
export async function getStats(): Promise<Stat[]> {
  const rows = await safeDb("getStats", () =>
    prisma.siteStat.findMany({
      where: { active: true, verified: true },
      orderBy: { sortOrder: "asc" },
    }),
  );

  if (!rows || rows.length === 0) {
    return STATS.filter((s) => s.verified).map((s) => ({
      key: s.key,
      label: s.label,
      value: s.value,
      prefix: s.prefix,
      suffix: s.suffix,
    }));
  }

  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.value,
    prefix: r.prefix ?? undefined,
    suffix: r.suffix ?? undefined,
  }));
}

export async function getGallery(): Promise<{ url: string; alt: string }[]> {
  const rows = await safeDb("getGallery", () =>
    prisma.galleryImage.findMany({ orderBy: { sortOrder: "asc" }, take: 12 }),
  );
  if (!rows || rows.length === 0) return GALLERY.map((g) => ({ url: g.url, alt: g.alt }));
  return rows.map((r) => ({ url: r.url, alt: r.alt }));
}

export async function getSponsors() {
  const rows = await safeDb("getSponsors", () =>
    prisma.sponsor.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  );
  // No seed fallback on purpose: the sponsor strip must stay hidden until the
  // client actually has sponsors to show. Inventing logos would be worse than
  // an empty section.
  return rows ?? [];
}

/* ---------------------------------------------------------------- helpers */

export function extractYouTubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m?.[1] ?? (/^[A-Za-z0-9_-]{11}$/.test(url) ? url : null);
}

/**
 * Counts abbreviate; money does not.
 *
 * A prize of 1000 must read "$1,000", never "$1K" — abbreviating a cash figure
 * makes it look smaller and it is the number the client advertises. Counts only
 * abbreviate from 10,000 up, so "$1,000" and "7,500 entries" both stay legible.
 */
export function formatStat(stat: Stat): string {
  const { value, prefix = "", suffix = "" } = stat;
  const isCurrency = prefix !== "";

  let n: string;
  if (isCurrency || value < 10_000) {
    n = value.toLocaleString("en-US");
  } else if (value >= 1_000_000) {
    n = trimZero(value / 1_000_000) + "M";
  } else {
    n = trimZero(value / 1_000) + "K";
  }

  return `${prefix}${n}${suffix}`;
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}
