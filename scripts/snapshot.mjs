/**
 * Screenshot every page, so a change can be looked at rather than assumed.
 *
 *   node scripts/snapshot.mjs                       # local dev server
 *   node scripts/snapshot.mjs https://example.com   # any deployment
 *   node scripts/snapshot.mjs <url> --admin         # include the dashboard
 *
 * Writes to snapshots/<host>/ at desktop and mobile widths. Mobile matters more
 * than usual here: this audience arrives from Facebook and YouTube on a phone.
 *
 * Console errors and failed requests are collected per page and printed at the
 * end — a page that looks right in a screenshot can still be throwing, and a
 * 404 on a media file is invisible until something is checked.
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const target = process.argv[2]?.startsWith("http")
  ? process.argv[2].replace(/\/+$/, "")
  : "http://localhost:3000";
const includeAdmin = process.argv.includes("--admin");

const PUBLIC_PAGES = [
  ["home", "/"],
  ["about", "/about"],
  ["shows", "/shows"],
  ["show-detail", "/shows/drop-that-mike"],
  ["winners", "/winners"],
  ["winner-detail", "/winners/pj-galloway"],
  ["watch", "/watch"],
  ["enter", "/enter"],
  ["join", "/join"],
  ["sponsors", "/sponsors"],
  ["rules", "/rules"],
  ["contact", "/contact"],
  ["thank-you", "/thank-you?from=contestant"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
];

const ADMIN_PAGES = [
  ["admin-overview", "/admin"],
  ["admin-leads", "/admin/leads"],
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const host = new URL(target).host.replace(/[:.]/g, "-");
const outDir = join("snapshots", host);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const problems = [];

async function shoot(context, label, path, viewport) {
  const page = await context.newPage();
  const errors = [];
  const failed = [];

  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("requestfailed", (r) => {
    failed.push(`${r.failure()?.errorText ?? "failed"} ${r.url().slice(0, 120)}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
  });

  const res = await page.goto(target + path, {
    waitUntil: "networkidle",
    timeout: 60_000,
  }).catch((e) => ({ status: () => 0, err: e.message }));

  // Let scroll-triggered reveals and the idle-attached hero video settle.
  await page.waitForTimeout(2500);

  const file = join(outDir, `${label}-${viewport.name}.png`);
  await page.screenshot({ path: file, fullPage: viewport.name === "desktop" });

  const status = res?.status?.() ?? 0;
  if (status >= 400 || status === 0) problems.push(`${path} [${viewport.name}] HTTP ${status}`);
  for (const e of errors) problems.push(`${path} [${viewport.name}] console: ${e}`);
  for (const f of failed) problems.push(`${path} [${viewport.name}] request: ${f}`);

  console.log(
    `  ${String(status).padEnd(3)} ${viewport.name.padEnd(7)} ${path.padEnd(34)} ${
      errors.length + failed.length ? `${errors.length + failed.length} issue(s)` : "clean"
    }`,
  );

  await page.close();
}

console.log(`target ${target}`);
console.log(`out    ${outDir}/\n`);

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    userAgent:
      viewport.name === "mobile"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
  });

  for (const [label, path] of PUBLIC_PAGES) {
    await shoot(context, label, path, viewport);
  }

  if (includeAdmin) {
    // Sign in once per context, then capture the dashboard.
    const page = await context.newPage();
    await page.goto(`${target}/admin/login`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.fill("#email", process.env.SNAPSHOT_ADMIN_EMAIL ?? "admin@deanslist.live");
    await page.fill("#password", process.env.SNAPSHOT_ADMIN_PASSWORD ?? "ChangeMe123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 30_000 }).catch(() => {});
    await page.close();

    for (const [label, path] of ADMIN_PAGES) {
      await shoot(context, label, path, viewport);
    }
  }

  await context.close();
}

await browser.close();

console.log(`\n${"-".repeat(64)}`);
if (problems.length === 0) {
  console.log("no console errors, no failed requests, every page 200");
} else {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
}

await writeFile(join(outDir, "report.txt"), problems.join("\n") || "clean", "utf8");
console.log(`\nreport written to ${join(outDir, "report.txt")}`);
