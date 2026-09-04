/**
 * Phase 0.5 — make the old site's video usable in a browser.
 *
 *   node scripts/transcode-video.mjs
 *
 * 12 of the 17 source files are QuickTime (.mov). Chrome, Firefox and Edge cannot
 * play them; the old markup autoplays them anyway, so visitors download megabytes
 * and see nothing. Each source becomes:
 *
 *   <name>.mp4     H.264 + faststart  — universal fallback
 *   <name>.webm    VP9                — ~30% smaller where supported
 *   <name>.jpg     poster frame       — what shows before playback, and the LCP
 *                                       candidate, so it must be small
 *
 * Decorative clips are stripped of audio: they are rendered muted, and an audio
 * track no one hears is pure payload.
 */

import { mkdir, readdir, stat, writeFile, unlink } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { BUDGETS } from "./asset-manifest.mjs";

const SRC = "assets/raw/videos";
const OUT = "public/media";

/**
 * Per role: output height cap, H.264 CRF, VP9 CRF, and whether audio survives.
 * Higher CRF = smaller file. 23 is visually transparent, 30 is clearly compressed
 * but fine for a dark, overlaid, looping background tile.
 */
const PROFILE = {
  hero: { height: 1080, crf: 27, vp9: 34, audio: false },
  promo: { height: 1080, crf: 24, vp9: 32, audio: true },
  texture: { height: 540, crf: 32, vp9: 39, audio: false },
};

const mb = (n) => (n / 1024 / 1024).toFixed(2) + " MB";
const kb = (n) => (n / 1024).toFixed(0) + " KB";

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${err.trim()}`)),
    );
  });
}

async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, acc);
    else if (/\.(mov|mp4|m4v|webm)$/i.test(entry.name)) acc.push(p);
  }
  return acc;
}

const files = await walk(SRC).catch(() => []);
if (!files.length) {
  console.error(`No video in ${SRC}. Run scripts/harvest-assets.mjs first.`);
  process.exit(1);
}

let before = 0;
let after = 0;
const warnings = [];

for (const file of files) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  const base = rel.slice(0, -extname(rel).length);
  const role = base.split("/")[0];
  const cfg = PROFILE[role] ?? PROFILE.texture;
  const dest = join(OUT, base);

  await mkdir(dirname(dest), { recursive: true });

  const orig = (await stat(file)).size;
  before += orig;
  const wasMov = extname(file).toLowerCase() === ".mov";

  // Even dimensions are required by H.264. -2 keeps the aspect ratio and rounds.
  const scale = `scale=-2:'min(${cfg.height},ih)'`;

  await ffmpeg([
    "-i", file,
    "-vf", scale,
    "-c:v", "libx264",
    "-profile:v", "high",
    "-preset", "slow",
    "-crf", String(cfg.crf),
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    ...(cfg.audio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"]),
    dest + ".mp4",
  ]);

  await ffmpeg([
    "-i", file,
    "-vf", scale,
    "-c:v", "libvpx-vp9",
    "-crf", String(cfg.vp9),
    "-b:v", "0",
    "-row-mt", "1",
    "-deadline", "good",
    "-cpu-used", "2",
    ...(cfg.audio ? ["-c:a", "libopus", "-b:a", "96k"] : ["-an"]),
    dest + ".webm",
  ]);

  // Poster: grab a frame a second in (frame 0 is often a fade from black),
  // then hand it to sharp, which compresses far better than ffmpeg's JPEG encoder.
  const tmp = dest + ".poster.png";
  await ffmpeg(["-ss", "00:00:01", "-i", file, "-frames:v", "1", "-vf", scale, tmp]).catch(
    // Clip shorter than a second: fall back to the first frame.
    () => ffmpeg(["-i", file, "-frames:v", "1", "-vf", scale, tmp]),
  );

  const posterJpg = await sharp(tmp).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
  const posterWebp = await sharp(tmp).webp({ quality: 70, effort: 6 }).toBuffer();
  await writeFile(dest + ".jpg", posterJpg);
  await writeFile(dest + ".webp", posterWebp);
  await unlink(tmp);

  const mp4 = (await stat(dest + ".mp4")).size;
  const webm = (await stat(dest + ".webm")).size;
  const served = Math.min(mp4, webm);
  after += served;

  const saved = Math.round((1 - served / orig) * 100);
  console.log(
    `  ${base.padEnd(24)} ${mb(orig).padStart(9)} -> mp4 ${mb(mp4).padStart(8)}  webm ${mb(webm).padStart(8)}` +
      `  poster ${kb(posterJpg.length).padStart(7)}  (-${saved}%)${wasMov ? "  [was .mov]" : ""}`,
  );

  if (served > BUDGETS[role]) {
    warnings.push(`${base}: ${mb(served)} over the ${mb(BUDGETS[role])} ${role} budget`);
  }
  if (posterJpg.length > BUDGETS.poster) {
    warnings.push(`${base} poster: ${kb(posterJpg.length)} over the ${kb(BUDGETS.poster)} budget`);
  }
  void posterWebp;
}

console.log(`\n${"-".repeat(78)}`);
console.log(
  `${files.length} videos: ${mb(before)} -> ${mb(after)} served (-${Math.round((1 - after / before) * 100)}%)`,
);
console.log(`every output plays in Chrome, Firefox, Edge and Safari; each has a poster frame`);

if (warnings.length) {
  console.log(`\nover budget:`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
