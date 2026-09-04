/**
 * Where media is served from.
 *
 * Every image and video path in the app is relative (e.g. "/media/hero/mic").
 * This resolves it against NEXT_PUBLIC_MEDIA_BASE_URL, so the same build can
 * serve from three places with no code change:
 *
 *   unset                              -> /public on the app server (default today)
 *   https://media.deanslist.live       -> Cloudflare R2 behind a custom domain
 *   https://res.cloudinary.com/<acct>  -> Cloudinary
 *
 * Why this matters at launch: the transcoded video is about 12 MB across 17
 * files. Serving that from a small VPS on the night a show goes live is the
 * first thing that falls over, and it is also the bandwidth bill. R2 has no
 * egress charge, which makes it the right home for video specifically.
 *
 * What this deliberately does NOT do is point at deanslist.live. Hotlinking the
 * old site would break every image and video the moment DNS is cut over to the
 * new one — and 12 of its 17 videos are QuickTime files no browser can play.
 * The originals are harvested and transcoded instead; see scripts/.
 */

const RAW = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim().replace(/\/+$/, "") ?? "";

export const mediaBase = RAW;

/** Resolve an app-relative media path against the configured base. */
export function media(path: string): string {
  if (!path) return path;
  // Already absolute (an external thumbnail, a full CDN URL): leave it alone.
  if (/^https?:\/\//i.test(path)) return path;
  if (!RAW) return path;
  return `${RAW}${path.startsWith("/") ? "" : "/"}${path}`;
}
