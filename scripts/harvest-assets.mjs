/**
 * Phase 0.3 — pull every usable image and video off the old Joomla site.
 *
 *   node scripts/harvest-assets.mjs
 *
 * Writes originals to assets/raw/ (gitignored). Idempotent: a file already on disk
 * with a non-zero size is skipped, so re-running after a partial failure is cheap.
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { ORIGIN, IMAGES, VIDEOS } from "./asset-manifest.mjs";

const RAW = "assets/raw";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const mb = (n) => (n / 1024 / 1024).toFixed(1) + " MB";

async function exists(p) {
  try {
    const s = await stat(p);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function download(item, kind) {
  const ext = extname(item.path);
  const dest = join(RAW, kind, item.out + ext);

  if (await exists(dest)) {
    const s = await stat(dest);
    console.log(`  skip   ${item.out}${ext.padEnd(5)} ${mb(s.size).padStart(9)}  (already on disk)`);
    return { ...item, dest, bytes: s.size, skipped: true };
  }

  const url = ORIGIN + item.path;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) {
    console.error(`  FAIL   ${item.out}  HTTP ${res.status}  ${url}`);
    return null;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);

  const ct = res.headers.get("content-type") ?? "?";
  const flag = ct === "video/quicktime" ? "  <- QuickTime, unplayable in browsers" : "";
  console.log(`  got    ${item.out}${ext.padEnd(5)} ${mb(buf.length).padStart(9)}  ${ct}${flag}`);
  return { ...item, dest, bytes: buf.length, contentType: ct, skipped: false };
}

async function run(list, kind) {
  console.log(`\n${kind.toUpperCase()} (${list.length})`);
  const out = [];
  // Serial on purpose: the old host is a shared GoDaddy box and 30 parallel
  // requests is how you get rate limited mid-harvest.
  for (const item of list) out.push(await download(item, kind));
  return out.filter(Boolean);
}

const images = await run(IMAGES, "images");
const videos = await run(VIDEOS, "videos");

const total = [...images, ...videos].reduce((n, a) => n + a.bytes, 0);
const quicktime = videos.filter((v) => v.contentType === "video/quicktime").length;

console.log(`\n${"-".repeat(60)}`);
console.log(`harvested ${images.length} images + ${videos.length} videos = ${mb(total)}`);
if (quicktime) {
  console.log(`${quicktime} of ${videos.length} videos are QuickTime and cannot play in any`);
  console.log(`major browser. Run scripts/transcode-video.mjs next.`);
}
console.log(`originals in ${RAW}/ (gitignored)`);
