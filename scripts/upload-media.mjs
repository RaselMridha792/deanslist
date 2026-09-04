/**
 * Push everything in public/media to Cloudinary.
 *
 *   node scripts/upload-media.mjs          # upload
 *   node scripts/upload-media.mjs --check   # verify what is already up there
 *
 * Reads CLOUDINARY_URL from .env:
 *   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 *
 * The key and secret are used ONLY here. Delivery needs nothing but the cloud
 * name, which is public — see src/lib/media.ts.
 *
 * Signing is done by hand rather than pulling in the Cloudinary SDK: this runs
 * once, and CLAUDE-style dependency discipline says a package that exists to
 * build one SHA-1 string is not worth carrying into production installs.
 *
 * Each file keeps its path as its public_id INCLUDING the extension, e.g.
 * "deanslist/gallery/cts-01.avif". That matters: cts-01.avif, cts-01.webp and
 * cts-01.jpg are three distinct files, and dropping the extension would make
 * them collide on one public_id and overwrite each other.
 */

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";

const ROOT = "public/media";
const FOLDER = "deanslist";

/* ------------------------------------------------------------------ config */

function loadEnv() {
  // .env is not loaded automatically in a bare node script.
  return readFile(".env", "utf8")
    .then((txt) => {
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    })
    .catch(() => {});
}

await loadEnv();

const url = process.env.CLOUDINARY_URL;
if (!url) {
  console.error(
    "\nCLOUDINARY_URL is not set.\n\n" +
      "Add this line to .env (it is gitignored, so it never reaches GitHub):\n\n" +
      "  CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>\n\n" +
      "Copy it from Cloudinary > Settings > API Keys, substituting your real key\n" +
      "and secret for the placeholders.\n",
  );
  process.exit(1);
}

const parsed = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
if (!parsed) {
  console.error("CLOUDINARY_URL is malformed. Expected cloudinary://key:secret@cloud_name");
  process.exit(1);
}
const [, API_KEY, API_SECRET, CLOUD] = parsed;

const CHECK_ONLY = process.argv.includes("--check");

/* ----------------------------------------------------------------- helpers */

const IMAGE_EXT = new Set([".avif", ".webp", ".jpg", ".jpeg", ".png"]);
const VIDEO_EXT = new Set([".mp4", ".webm"]);

const mb = (n) => (n / 1024 / 1024).toFixed(2) + " MB";

/** Cloudinary signs the alphabetically sorted params, then appends the secret. */
function sign(params) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + API_SECRET).digest("hex");
}

async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

async function upload(file) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const ext = extname(file).toLowerCase();

  const resourceType = VIDEO_EXT.has(ext) ? "video" : IMAGE_EXT.has(ext) ? "image" : null;
  if (!resourceType) return { rel, skipped: "unsupported type" };

  // Extension kept in the public_id so the three formats of one image stay distinct.
  const publicId = `${FOLDER}/${rel}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const params = {
    public_id: publicId,
    timestamp,
    overwrite: "true",
    invalidate: "true",
    unique_filename: "false",
    use_filename: "false",
  };

  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append("api_key", API_KEY);
  form.append("signature", sign(params));

  const buf = await readFile(file);
  form.append("file", new Blob([buf]), rel.split("/").pop());

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/upload`,
    { method: "POST", body: form },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { rel, error: body?.error?.message ?? `HTTP ${res.status}` };
  }
  return { rel, url: body.secure_url, bytes: body.bytes, resourceType };
}

/* --------------------------------------------------------------------- run */

const files = await walk(ROOT).catch(() => []);
if (!files.length) {
  console.error(`Nothing in ${ROOT}. Run the harvest and optimise scripts first.`);
  process.exit(1);
}

const images = files.filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
const videos = files.filter((f) => VIDEO_EXT.has(extname(f).toLowerCase()));
const totalBytes = (
  await Promise.all(files.map(async (f) => (await stat(f)).size))
).reduce((a, b) => a + b, 0);

console.log(`cloud    ${CLOUD}`);
console.log(`folder   ${FOLDER}/`);
console.log(`files    ${images.length} images + ${videos.length} videos = ${mb(totalBytes)}\n`);

if (CHECK_ONLY) {
  // Delivery needs no credentials, so verifying is just a HEAD request.
  let ok = 0;
  let missing = 0;
  for (const f of files.slice(0, 400)) {
    const rel = relative(ROOT, f).replace(/\\/g, "/");
    const type = VIDEO_EXT.has(extname(f).toLowerCase()) ? "video" : "image";
    const u = `https://res.cloudinary.com/${CLOUD}/${type}/upload/${FOLDER}/${rel}`;
    const r = await fetch(u, { method: "HEAD" });
    if (r.ok) ok++;
    else {
      missing++;
      console.log(`  MISSING  ${rel}`);
    }
  }
  console.log(`\n${ok} present, ${missing} missing`);
  process.exit(missing ? 1 : 0);
}

let done = 0;
let failed = 0;
let uploaded = 0;

// Serial. A free-tier account rate limits, and a half-uploaded set is worse
// than a slow one.
for (const f of files) {
  const r = await upload(f);
  if (r.error) {
    failed++;
    console.log(`  FAIL  ${r.rel}  ${r.error}`);
  } else if (r.skipped) {
    console.log(`  skip  ${r.rel}  (${r.skipped})`);
  } else {
    done++;
    uploaded += r.bytes ?? 0;
    process.stdout.write(`\r  uploaded ${done}/${files.length}  ${mb(uploaded)}   `);
  }
}

console.log(`\n\n${done} uploaded, ${failed} failed`);
console.log(`\nSet these in .env, then rebuild:\n`);
console.log(`  NEXT_PUBLIC_MEDIA_IMAGE_BASE="https://res.cloudinary.com/${CLOUD}/image/upload/${FOLDER}"`);
console.log(`  NEXT_PUBLIC_MEDIA_VIDEO_BASE="https://res.cloudinary.com/${CLOUD}/video/upload/${FOLDER}"\n`);
console.log(`Then verify with: node scripts/upload-media.mjs --check\n`);
