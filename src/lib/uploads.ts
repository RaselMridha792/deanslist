import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Uploaded images, stored on this server's own disk.
 *
 * The site runs on one VPS with its own storage, so an upload is a file in a
 * directory rather than an object in somebody else's bucket. There is no second
 * account to hand over, no key to leak, and nothing that stops working when a
 * card on file expires.
 *
 * In Docker the directory is the `uploads` volume, mounted at /app/uploads.
 * Caddy serves it straight from disk; src/app/uploads/[...path]/route.ts serves
 * the same files wherever Caddy is not in front (development, CI).
 *
 * Every upload is re-encoded, never stored as sent:
 *
 *   It proves the file is an image. sharp decodes it or throws, so a script
 *   renamed to photo.jpg is refused however it was labelled.
 *
 *   It strips what the camera wrote into it. Phone photos carry EXIF, and EXIF
 *   carries GPS: a contestant's portrait could otherwise publish where they
 *   live. sharp drops metadata unless asked to keep it.
 *
 *   It produces the set the site asks for. <picture> requests .avif, then .webp,
 *   then .jpg, and a browser that picks a source does not fall back when that
 *   file is missing. So all three are written, or none.
 */

/** Where files are written. /app/uploads in the image, ./uploads otherwise. */
export const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"),
);

/** The public URL prefix, and the subdirectory, for uploaded images. */
export const UPLOAD_URL_PREFIX = "/uploads";
const IMAGE_SUBDIR = "images";

/** What the upload form will take. Checked against the decoded file, not the label. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif", "tiff"]);

/**
 * A decompression bomb is a small file that decodes to an enormous image. The
 * VPS has 4 GB of memory shared with Postgres; 50 megapixels is well past any
 * real photograph and well short of trouble.
 */
const MAX_INPUT_PIXELS = 50_000_000;

/** Longest edge after resizing. Past this, bytes grow and nobody sees the gain. */
const MAX_EDGE = 2400;

/**
 * One file at a time. The VPS has a single core; letting libvips spread one
 * encode across threads that do not exist only adds contention with the server
 * answering visitors.
 */
sharp.concurrency(1);

/** Names this module writes: 24 hex characters, then one of three extensions. */
const STORED_NAME = /^[a-f0-9]{24}\.(avif|webp|jpg)$/;

export const IMAGE_TYPES: Record<string, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpg: "image/jpeg",
};

export class UploadRejected extends Error {}

export type StoredImage = {
  /** Extensionless, the shape every image field on the site stores. */
  path: string;
  width: number;
  height: number;
  /** Bytes on disk across all three files. */
  bytes: number;
  /** Detected from the file itself. */
  format: string;
  hasAlpha: boolean;
};

/**
 * Decode, clean and store one image. Throws UploadRejected, with a message fit
 * to show the person uploading, for anything that is not a usable image.
 */
export async function storeImage(input: Buffer): Promise<StoredImage> {
  if (input.byteLength === 0) throw new UploadRejected("That file is empty.");
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadRejected(
      `That file is ${(input.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );
  }

  const meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .metadata()
    .catch(() => null);
  if (!meta) {
    throw new UploadRejected(
      "That file is not an image this site can read. Use a JPEG, PNG, WebP or AVIF. iPhone HEIC photos: export or share them as JPEG first.",
    );
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new UploadRejected(
      `A ${meta.format ?? "file of that kind"} cannot be used here. Use a JPEG, PNG, WebP or AVIF.`,
    );
  }
  if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS) {
    throw new UploadRejected("That image is too large in pixels. Resize it under 50 megapixels.");
  }

  // One decode, shared by all three encoders. rotate() with no argument applies
  // the EXIF orientation before the EXIF is dropped, so a portrait shot on a
  // phone does not arrive lying on its side.
  const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });

  const encoded = await (async () => {
    // effort 4 rather than the default: on one core a 2400px AVIF at the
    // default effort takes long enough for the person uploading to wonder.
    const avif = await base.clone().avif({ quality: 62, effort: 4 }).toBuffer();
    const webp = await base.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    // JPEG has no transparency. Flattened onto white, the colour a logo with a
    // transparent background was almost certainly drawn against.
    const jpg = await base
      .clone()
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    return { avif, webp: webp.data, info: webp.info, jpg };
  })().catch(() => null);
  if (!encoded) {
    throw new UploadRejected("That image could not be processed. Try saving it again as a JPEG.");
  }
  const { avif, webp, jpg, info } = encoded;

  const id = randomBytes(12).toString("hex");
  const dir = path.join(UPLOAD_DIR, IMAGE_SUBDIR);
  await mkdir(dir, { recursive: true });

  // Written under temporary names and renamed into place, so a request that
  // arrives mid-write never finds half a file, and a failure leaves nothing a
  // page could point at.
  const files: [string, Buffer][] = [
    [`${id}.avif`, avif],
    [`${id}.webp`, webp],
    [`${id}.jpg`, jpg],
  ];
  try {
    for (const [name, data] of files) {
      await writeFile(path.join(dir, `.${name}.tmp`), data, { flag: "wx" });
    }
    for (const [name] of files) {
      await rename(path.join(dir, `.${name}.tmp`), path.join(dir, name));
    }
  } catch (err) {
    await Promise.all(
      files.flatMap(([name]) => [
        rm(path.join(dir, `.${name}.tmp`), { force: true }),
        rm(path.join(dir, name), { force: true }),
      ]),
    );
    throw err;
  }

  return {
    path: `${UPLOAD_URL_PREFIX}/${IMAGE_SUBDIR}/${id}`,
    width: info.width,
    height: info.height,
    bytes: avif.byteLength + webp.byteLength + jpg.byteLength,
    format: meta.format,
    hasAlpha: Boolean(meta.hasAlpha),
  };
}

/**
 * Read one stored file for the fallback route, or null.
 *
 * The request path is matched against the exact shape this module writes
 * before it goes anywhere near the filesystem, so `..`, encoded slashes, dot
 * files and the temporary names are all a plain not-found. Nothing the public
 * sends is ever joined onto a path unchecked.
 */
export async function readStoredFile(
  segments: string[],
): Promise<{ data: Buffer; type: string } | null> {
  if (segments.length !== 2 || segments[0] !== IMAGE_SUBDIR) return null;
  const name = segments[1];
  const match = STORED_NAME.exec(name);
  if (!match) return null;
  try {
    const data = await readFile(path.join(UPLOAD_DIR, IMAGE_SUBDIR, name));
    return { data, type: IMAGE_TYPES[match[1]] };
  } catch {
    return null;
  }
}
