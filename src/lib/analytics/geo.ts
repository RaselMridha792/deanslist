import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Reader, type CountryResponse } from "mmdb-lib";

/**
 * Country from an IP address, looked up in a file on this server.
 *
 * The file is DB-IP's free country database (scripts/fetch-geo.mjs puts it in
 * geo/; the Docker image downloads it at build time). A lookup is a walk through
 * an in-memory tree, a few microseconds, and the address never leaves the
 * machine — no API, no third party, nothing to disclose on the privacy page.
 *
 * Absent file, unreadable file, private address, garbage input: every one of
 * those answers null. Country is a nicety on a page view, and a page view must
 * never fail because of it.
 */

const DB_PATH = process.env.GEOIP_DB_PATH || path.join(process.cwd(), "geo", "dbip-country-lite.mmdb");

/** Retry a missing file this often, so `npm run geo:fetch` works without a restart. */
const RETRY_MS = 10 * 60_000;

let opening: Promise<Reader<CountryResponse> | null> | null = null;
let failedAt = 0;

function open(): Promise<Reader<CountryResponse> | null> {
  if (opening) return opening;
  if (failedAt && Date.now() - failedAt < RETRY_MS) return Promise.resolve(null);

  opening = readFile(DB_PATH)
    .then((buffer) => new Reader<CountryResponse>(buffer))
    .catch(() => {
      failedAt = Date.now();
      opening = null;
      return null;
    });
  return opening;
}

/** ISO 3166-1 alpha-2, upper case, or null. */
export async function lookupCountry(ip: string): Promise<string | null> {
  const reader = await open();
  if (!reader) return null;
  try {
    const code = reader.get(ip)?.country?.iso_code;
    return typeof code === "string" && /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/**
 * Whether lookups are working, and how old the data is, for the analytics
 * screen to say so. A silent null country on every row would look like a
 * site with no foreign visitors rather than a missing file.
 */
export async function geoStatus(): Promise<{ available: boolean; updated: Date | null }> {
  const reader = await open();
  if (!reader) return { available: false, updated: null };
  const info = await stat(DB_PATH).catch(() => null);
  return { available: true, updated: info?.mtime ?? null };
}
