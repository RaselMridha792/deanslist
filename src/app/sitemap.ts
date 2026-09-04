import type { MetadataRoute } from "next";
import { getShows, getWinners } from "@/lib/queries";
import { absoluteUrl } from "@/lib/seo";

/**
 * XML sitemap.
 *
 * Rendered per request rather than at build time. Every dynamic page in this app
 * already sets `dynamic = "force-dynamic"`, and more to the point, generating
 * this at build would make `next build` depend on a reachable database — on a
 * one-core VPS that turns a transient Postgres hiccup into a failed deploy.
 * Crawlers hit a sitemap a handful of times a day; two queries is nothing.
 */
export const dynamic = "force-dynamic";

/**
 * `lastModified` is omitted rather than faked.
 *
 * Google's own guidance is that lastmod is used only where it is consistently
 * accurate, and ignored — or held against the site — where it is not. Stamping
 * `new Date()` on every entry, which is the usual shortcut, tells a crawler that
 * all fourteen pages changed on every deploy. That is not true and it wastes the
 * crawl budget of a site that has one genuinely fresh section.
 *
 * So a date appears only where the database holds a real one, and only when it
 * is in the past. A future date is invalid as a modification time and search
 * engines discard the whole hint when they see one.
 *
 * NOTE for whoever owns src/lib/queries.ts: `Show` carries `updatedAt` in
 * prisma/schema.prisma but the query layer does not project it, and `Winner` has
 * no `updatedAt` column at all. Surfacing both would make these dates track real
 * edits instead of standing in for them. See the report.
 */
function pastDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.getTime() <= Date.now() ? d : undefined;
}

type Entry = MetadataRoute.Sitemap[number];

/**
 * Static public routes.
 *
 * Three public pages are deliberately absent:
 *   /rules and /terms  — noindex via their own metadata until the client
 *                        supplies the real legal wording.
 *   /thank-you         — noindex, nofollow; a post-submission confirmation has
 *                        no business in search results.
 *
 * Listing a noindex URL in a sitemap is a direct contradiction and Search
 * Console reports it as an error, so they are excluded here rather than
 * included for completeness. They stay crawlable in robots.txt — a page has to
 * be fetched for its noindex to be seen.
 *
 * `changeFrequency` and `priority` are advisory. Google ignores both; Bing and
 * several smaller crawlers still read them, and they cost nothing.
 */
const STATIC_ROUTES: { path: string; changeFrequency: Entry["changeFrequency"]; priority: number }[] =
  [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/enter", changeFrequency: "weekly", priority: 0.9 },
    { path: "/shows", changeFrequency: "weekly", priority: 0.8 },
    { path: "/watch", changeFrequency: "weekly", priority: 0.7 },
    { path: "/winners", changeFrequency: "monthly", priority: 0.7 },
    { path: "/about", changeFrequency: "monthly", priority: 0.6 },
    { path: "/join", changeFrequency: "monthly", priority: 0.6 },
    { path: "/sponsors", changeFrequency: "monthly", priority: 0.6 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  ];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: absoluteUrl(r.path),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  /**
   * A database fault degrades the sitemap; it does not 500 it.
   *
   * `@/lib/queries` rethrows in production by design, which is right for a page
   * — an error beats serving stale copy from a broken deployment. It is wrong
   * here. A sitemap that returns 500 for a few hours can get its URLs dropped,
   * and the static half of this file needs no database at all. So the dynamic
   * half is allowed to fail on its own.
   */
  const [shows, winners] = await Promise.all([
    getShows().catch((err: unknown) => {
      console.error("[sitemap] shows unavailable:", err);
      return [];
    }),
    getWinners().catch((err: unknown) => {
      console.error("[sitemap] winners unavailable:", err);
      return [];
    }),
  ]);

  const showEntries: MetadataRoute.Sitemap = shows.map((show) => ({
    url: absoluteUrl(`/shows/${show.slug}`),
    // A show that has already aired has settled content. One still ahead has
    // no meaningful modification date yet, so it gets none.
    lastModified: pastDate(show.startsAt),
    changeFrequency: show.status === "OPEN" || show.status === "LIVE" ? "daily" : "monthly",
    priority: show.status === "OPEN" || show.status === "LIVE" ? 0.9 : 0.6,
  }));

  const winnerEntries: MetadataRoute.Sitemap = winners.map((winner) => ({
    url: absoluteUrl(`/winners/${winner.slug}`),
    // The announcement date is the publication date of the profile, which is
    // the closest thing to a true lastmod the schema currently holds.
    lastModified: pastDate(winner.announcedAt),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...base, ...showEntries, ...winnerEntries];
}
