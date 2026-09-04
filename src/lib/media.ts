/**
 * Where media is served from.
 *
 * Every media path in the app is relative ("/media/hero/mic"). This resolves it
 * against a configured base, so the same build serves from anywhere with no code
 * change. Images and video are configured separately because Cloudinary splits
 * them into different delivery paths.
 *
 *   both unset
 *     -> /public on the app server (the default, and what runs today)
 *
 *   R2 / any static host, one bucket holding the public/media tree:
 *     IMAGE = VIDEO = https://media.deanslist.live
 *
 *   Cloudinary, uploaded under a "deanslist" folder:
 *     IMAGE = https://res.cloudinary.com/<cloud>/image/upload/deanslist
 *     VIDEO = https://res.cloudinary.com/<cloud>/video/upload/deanslist
 *
 * Note the cloud name is all that is needed to SERVE. The API key and secret are
 * only for uploading, stay in .env, and never reach the browser.
 *
 * This deliberately cannot point at deanslist.live: hotlinking the old site would
 * break every asset at DNS cutover, and 12 of its 17 videos are QuickTime that no
 * browser can decode.
 */

const clean = (v?: string) => v?.trim().replace(/\/+$/, "") ?? "";

const IMAGE_BASE = clean(process.env.NEXT_PUBLIC_MEDIA_IMAGE_BASE);
const VIDEO_BASE = clean(process.env.NEXT_PUBLIC_MEDIA_VIDEO_BASE);

function resolve(base: string, path: string): string {
  if (!path) return path;
  // Already absolute (an external thumbnail, a full CDN URL): leave it alone.
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Resolve an image path (.avif / .webp / .jpg / .png). */
export function mediaImage(path: string): string {
  return resolve(IMAGE_BASE, path);
}

/** Resolve a video path (.mp4 / .webm) or its poster frame. */
export function mediaVideo(path: string): string {
  return resolve(VIDEO_BASE, path);
}

/** True once media is served from somewhere other than this app server. */
export const usingCdn = Boolean(IMAGE_BASE || VIDEO_BASE);
