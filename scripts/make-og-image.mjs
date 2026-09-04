/**
 * Generates the social share card and app icons.
 *
 *   node scripts/make-og-image.mjs
 *
 * The old site declares `og:image` as `https://deanslist.live/` — the site root,
 * an HTML document rather than an image — which is the whole reason its share
 * previews render as a bare link. Producing a real 1200x630 file is the fix.
 *
 * Run once and commit the output; there is no need for this in the build.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const OUT = "public";
const APP = "src/app";
const KEY_ART = "assets/raw/images/shows/drop-that-mike-key-art.jpg";
const LOGO = "assets/raw/images/brand/logo.png";

const W = 1200;
const H = 630;

await mkdir(OUT, { recursive: true });

/* ---------------------------------------------------------------- og.jpg */

// Key art, cropped to card ratio and pushed well back so type stays readable.
const bg = await sharp(KEY_ART)
  .resize(W, H, { fit: "cover", position: "attention" })
  .modulate({ brightness: 0.42, saturation: 0.75 })
  .blur(2)
  .toBuffer();

// Scrim: darkest at the bottom where the text sits.
const scrim = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#0A0A0C" stop-opacity="0.55"/>
      <stop offset="45%"  stop-color="#0A0A0C" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#0A0A0C" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#7A5E14"/>
      <stop offset="30%"  stop-color="#D4AF37"/>
      <stop offset="52%"  stop-color="#F7ECC6"/>
      <stop offset="74%"  stop-color="#D4AF37"/>
      <stop offset="100%" stop-color="#7A5E14"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#s)"/>
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="url(#gold)"/>
</svg>`);

// Impact is the closest widely-installed stand-in for the Bebas Neue titling
// face. This file is generated once and committed, so it renders on this machine
// and ships as a static asset — it is never re-rendered on a server.
const type = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="80" y="366" font-family="Impact, Haettenschweiler, sans-serif"
        font-size="104" fill="#FFFFFF" letter-spacing="2">THE DEAN'S LIST</text>
  <text x="80" y="424" font-family="Segoe UI, Arial, sans-serif" font-size="27"
        font-weight="600" fill="#D4AF37" letter-spacing="7">GLOBAL TALENT COMPETITION</text>
  <text x="80" y="494" font-family="Segoe UI, Arial, sans-serif" font-size="26"
        fill="#FFFFFF" opacity="0.76">Perform from home. Get voted live. Win the prize.</text>
</svg>`);

const logo = await sharp(LOGO).resize({ width: 190 }).png().toBuffer();

const og = await sharp(bg)
  .composite([
    { input: scrim, top: 0, left: 0 },
    { input: logo, top: 58, left: 78 },
    { input: type, top: 0, left: 0 },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toBuffer();

await writeFile(join(OUT, "og.jpg"), og);
console.log(`og.jpg              ${W}x${H}  ${(og.length / 1024).toFixed(0)} KB`);

/* ---------------------------------------------------------------- icons */

// App Router file conventions: Next emits the correct <link> tags for these.
const icon = await sharp(LOGO)
  .resize(512, 512, { fit: "contain", background: { r: 10, g: 10, b: 12, alpha: 1 } })
  .png()
  .toBuffer();
await writeFile(join(APP, "icon.png"), icon);
console.log(`src/app/icon.png    512x512  ${(icon.length / 1024).toFixed(0)} KB`);

const apple = await sharp(LOGO)
  .resize(180, 180, { fit: "contain", background: { r: 10, g: 10, b: 12, alpha: 1 } })
  .png()
  .toBuffer();
await writeFile(join(APP, "apple-icon.png"), apple);
console.log(`src/app/apple-icon.png 180x180  ${(apple.length / 1024).toFixed(0)} KB`);
