/**
 * Phase 0.4 — turn the harvested originals into web-ready images.
 *
 *   node scripts/optimize-images.mjs
 *
 * The old site ships 13 MB of Fireworks PNG exports, the largest a 3.7 MB
 * screenshot. Everything here becomes AVIF + WebP at a sane resolution, written
 * to public/media/. A JPEG fallback is emitted for photos so anything that reads
 * the file directly (an email client, an OG scraper) still gets a picture.
 */

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import sharp from "sharp";
import { BUDGETS } from "./asset-manifest.mjs";

const SRC = "assets/raw/images";
const OUT = "public/media";

/** Long-edge cap per role. Nothing on this site is displayed above 2000px. */
const MAX_EDGE = { brand: 800, photo: 2000, poster: 1600 };

const kb = (n) => (n / 1024).toFixed(0) + " KB";

function roleFor(rel) {
  if (rel.startsWith("brand/")) return "brand";
  return "photo";
}

async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, acc);
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) acc.push(p);
  }
  return acc;
}

const files = await walk(SRC).catch(() => []);
if (!files.length) {
  console.error(`No images in ${SRC}. Run scripts/harvest-assets.mjs first.`);
  process.exit(1);
}

let before = 0;
let after = 0;
const overBudget = [];

for (const file of files) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  const base = rel.slice(0, -extname(rel).length);
  const role = roleFor(rel);
  const cap = MAX_EDGE[role];

  const src = sharp(file, { limitInputPixels: 512_000_000 });
  const meta = await src.metadata();
  const orig = (await stat(file)).size;
  before += orig;

  const resize =
    meta.width > cap || meta.height > cap
      ? { width: cap, height: cap, fit: "inside", withoutEnlargement: true }
      : null;

  const pipeline = () => {
    const p = sharp(file, { limitInputPixels: 512_000_000 });
    return resize ? p.resize(resize) : p;
  };

  await mkdir(dirname(join(OUT, base)), { recursive: true });

  // Logos and icons keep an alpha channel and stay lossless-ish.
  const lossless = role === "brand";

  const avif = await pipeline()
    .avif({ quality: lossless ? 70 : 55, effort: 6 })
    .toBuffer();
  const webp = await pipeline()
    .webp({ quality: lossless ? 90 : 78, effort: 6 })
    .toBuffer();

  await writeFile(join(OUT, base + ".avif"), avif);
  await writeFile(join(OUT, base + ".webp"), webp);

  let fallbackBytes = 0;
  if (role === "brand") {
    const png = await pipeline().png({ compressionLevel: 9, palette: true }).toBuffer();
    await writeFile(join(OUT, base + ".png"), png);
    fallbackBytes = png.length;
  } else {
    const jpg = await pipeline().jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    await writeFile(join(OUT, base + ".jpg"), jpg);
    fallbackBytes = jpg.length;
  }

  // What a browser actually downloads is the smallest supported format, not the sum.
  const served = Math.min(avif.length, webp.length);
  after += served;

  const dims = resize ? `${meta.width}x${meta.height} -> max ${cap}` : `${meta.width}x${meta.height}`;
  const saved = orig > 0 ? Math.round((1 - served / orig) * 100) : 0;
  console.log(
    `  ${base.padEnd(34)} ${kb(orig).padStart(8)} -> ${kb(served).padStart(8)}  (-${saved}%)  ${dims}`,
  );

  if (served > BUDGETS[role]) {
    overBudget.push(`${base}: ${kb(served)} exceeds the ${kb(BUDGETS[role])} ${role} budget`);
  }
  void fallbackBytes;
}

console.log(`\n${"-".repeat(70)}`);
console.log(`${files.length} images: ${kb(before)} -> ${kb(after)} served (-${Math.round((1 - after / before) * 100)}%)`);
console.log(`written to ${OUT}/ as .avif + .webp + a .jpg/.png fallback`);

if (overBudget.length) {
  console.log(`\nover budget:`);
  for (const w of overBudget) console.log(`  ! ${w}`);
}
