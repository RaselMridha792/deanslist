#!/usr/bin/env node
/**
 * Download the country lookup database the visitor statistics use.
 *
 *   node scripts/fetch-geo.mjs                  -> ./geo/dbip-country-lite.mmdb
 *   node scripts/fetch-geo.mjs /geo/out.mmdb    -> that path
 *   GEO_MONTH=2026-09 node scripts/fetch-geo.mjs
 *
 * The data is DB-IP's "IP to Country Lite": free, no account, and licensed
 * CC BY 4.0, which requires crediting DB-IP wherever the data is shown. The
 * analytics screen carries that credit. It is about 4 MB compressed.
 *
 * Why a file on our own disk rather than a lookup API: an API call per page view
 * would send every visitor's address to a third party, which is the one thing
 * the privacy page says does not happen. Looking it up locally means the address
 * never leaves the server.
 *
 * DB-IP publishes one file per month, early in the month. So the current month
 * is tried first and the previous one second, which covers the days before the
 * new file appears. A country database a month or two old is still right for
 * nearly every address; blocks of addresses rarely change country.
 *
 * Exits 1 when nothing could be fetched. The Dockerfile tolerates that, so an
 * outage at DB-IP cannot block a deploy: the site then records visits with no
 * country, and the analytics screen says the lookup is unavailable.
 */

import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const target = resolve(process.argv[2] ?? "geo/dbip-country-lite.mmdb");

/** Every MaxMind-format database ends its data section with this marker. */
const METADATA_MARKER = Buffer.from("\xab\xcd\xefMaxMind.com", "latin1");

function months() {
  const pinned = process.env.GEO_MONTH;
  const base = pinned && /^\d{4}-\d{2}$/.test(pinned)
    ? new Date(`${pinned}-01T00:00:00Z`)
    : new Date();
  const current = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const previous = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1));
  return [current, previous].map((d) => d.toISOString().slice(0, 7));
}

async function fetchMonth(month) {
  const url = `https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz`;
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);

  const db = gunzipSync(Buffer.from(await res.arrayBuffer()));
  // A truncated download or an HTML error page gunzips to something that is not
  // a database. Refuse it here rather than let the app fail to open it later.
  if (db.lastIndexOf(METADATA_MARKER) === -1) {
    throw new Error(`${url} did not contain a MaxMind-format database`);
  }
  return db;
}

for (const month of months()) {
  try {
    const db = await fetchMonth(month);
    await mkdir(dirname(target), { recursive: true });
    // Written beside the target and renamed over it, so a running server that
    // opens the file never reads half of one.
    const partial = `${target}.partial`;
    await writeFile(partial, db);
    await rename(partial, target);
    console.log(`geo: DB-IP country lite ${month}, ${(db.length / 1e6).toFixed(1)} MB -> ${target}`);
    process.exit(0);
  } catch (error) {
    console.warn(`geo: ${month} unavailable: ${error.message}`);
  }
}

console.error("geo: no country database could be downloaded");
process.exit(1);
