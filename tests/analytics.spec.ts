import { test, expect, type Page } from "playwright/test";
import { existsSync } from "node:fs";

/**
 * Visitor statistics: what is recorded, what is not, and what the screen shows.
 *
 * The promises worth a test are the privacy page's. A page view keeps its
 * source and country but not the address or the query string; a crawler, a
 * page on another site and a signed-in member of staff are not counted; a
 * token in a path is never stored. The screen is checked last, against rows
 * this file made itself.
 *
 * Local only: it reads rows back through Prisma. It uses a desktop Chrome user
 * agent, because the collector rightly ignores the headless one Playwright
 * sends by default.
 */

const TARGET = process.env.BASE_URL ?? "http://localhost:3000";
const IS_LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(TARGET).hostname);

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@deanslist.live";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

test.skip(!IS_LOCAL, "reads page views back from the database; local server only");
test.use({ userAgent: CHROME_UA });

async function prisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

/** The database's clock, not this machine's: rows are stamped by the database. */
let startedAt = new Date(0);

test.beforeAll(async () => {
  const db = await prisma();
  try {
    const [row] = await db.$queryRaw<{ now: Date }[]>`SELECT now() AT TIME ZONE 'UTC' AS now`;
    startedAt = row.now;
  } finally {
    await db.$disconnect();
  }
});

test.afterAll(async () => {
  const db = await prisma();
  try {
    await db.pageView.deleteMany({ where: { createdAt: { gte: startedAt } } });
  } finally {
    await db.$disconnect();
  }
});

async function viewsFor(path: string) {
  const db = await prisma();
  try {
    return await db.pageView.findMany({ where: { path, createdAt: { gte: startedAt } }, orderBy: { id: "asc" } });
  } finally {
    await db.$disconnect();
  }
}

function nextBeacon(page: Page) {
  return page.waitForRequest((r) => r.url().endsWith("/api/collect") && r.method() === "POST", { timeout: 30_000 });
}

let ipCounter = 0;
async function signIn(page: Page) {
  ipCounter += 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.60.${ipCounter}` });
  await page.goto("/admin/login");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/admin$/, { timeout: 60_000 }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
}

test("an arrival is recorded with its source, and nothing that identifies the visitor", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "8.8.8.8" });
  const beacon = nextBeacon(page);
  await page.goto("/rules?utm_source=fb&utm_campaign=e2e-spring&email=someone@example.com", {
    referer: "https://l.facebook.com/",
  });

  const sent = (await beacon).postData() ?? "";
  expect(sent, "the query string never leaves the page").not.toContain("someone@example.com");

  await expect.poll(async () => (await viewsFor("/rules")).length, { timeout: 20_000 }).toBeGreaterThan(0);
  const row = (await viewsFor("/rules")).at(-1)!;

  expect(row.isEntry).toBe(true);
  expect(row.source).toBe("Facebook");
  expect(row.utmCampaign).toBe("e2e-spring");
  expect(row.visitorHash).toMatch(/^[0-9a-f]{32}$/);
  expect([row.device, row.browser, row.os]).toEqual(["desktop", "Chrome", "Windows"]);
  if (existsSync("geo/dbip-country-lite.mmdb")) expect(row.country).toBe("US");
  expect(JSON.stringify(row), "no address anywhere in the row").not.toContain("8.8.8.8");
});

test("the next page of the same visit is a page view, not a second arrival", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "8.8.4.4" });
  await page.goto("/about", { referer: "https://www.google.com/" });
  await expect.poll(async () => (await viewsFor("/about")).length, { timeout: 20_000 }).toBeGreaterThan(0);
  expect((await viewsFor("/about")).at(-1)!.source).toBe("Google");

  // A link in the header, followed without a reload.
  const link = page.locator('header a[href^="/"]:not([href="/"]):not([href="/about"])').first();
  const href = (await link.getAttribute("href"))!;
  const beacon = nextBeacon(page);
  await link.click();
  await beacon;

  await expect.poll(async () => (await viewsFor(href)).length, { timeout: 20_000 }).toBeGreaterThan(0);
  const second = (await viewsFor(href)).at(-1)!;
  expect(second.isEntry).toBe(false);
  expect(second.source).toBeNull();
});

test("crawlers, other sites and token paths are handled as promised", async ({ request }) => {
  const person = { "content-type": "text/plain", "user-agent": CHROME_UA, "sec-fetch-site": "same-origin", "x-forwarded-for": "9.9.9.9" };
  const post = (path: string, headers: Record<string, string>) =>
    request.post("/api/collect", { headers, data: JSON.stringify({ p: path, e: true, t: false }) });

  const stamp = Date.now();
  const control = `/e2e-control-${stamp}`;
  const crawler = `/e2e-crawler-${stamp}`;
  const elsewhere = `/e2e-elsewhere-${stamp}`;

  expect((await post(control, person)).status()).toBe(204);
  expect((await post(crawler, { ...person, "user-agent": GOOGLEBOT_UA })).status()).toBe(204);
  expect((await post(elsewhere, { ...person, "sec-fetch-site": "cross-site" })).status()).toBe(204);
  expect((await post("/unsubscribe/e2e-secret-token?utm_source=x", person)).status()).toBe(204);

  // The control proves the other two were refused, not merely slow.
  await expect.poll(async () => (await viewsFor(control)).length, { timeout: 20_000 }).toBe(1);
  expect(await viewsFor(crawler), "a crawler is not a visitor").toHaveLength(0);
  expect(await viewsFor(elsewhere), "a post from another site is dropped").toHaveLength(0);

  await expect.poll(async () => (await viewsFor("/unsubscribe/[token]")).length, { timeout: 20_000 }).toBeGreaterThan(0);
  const db = await prisma();
  try {
    expect(await db.pageView.count({ where: { path: { contains: "e2e-secret-token" } } })).toBe(0);
  } finally {
    await db.$disconnect();
  }
});

test("staff signed in to the dashboard are not counted", async ({ page }) => {
  await signIn(page);
  const beacon = nextBeacon(page);
  await page.goto("/sponsors");
  await beacon;
  await page.waitForTimeout(2500);
  expect(await viewsFor("/sponsors")).toHaveLength(0);
});

test("the analytics screen shows what was recorded", async ({ page, request }) => {
  // Three visitors to one page, arriving from Google, so it leads both tables.
  const path = `/e2e-dashboard-${Date.now()}`;
  for (const ip of ["1.0.0.1", "1.0.0.2", "1.0.0.3"]) {
    await request.post("/api/collect", {
      headers: { "content-type": "text/plain", "user-agent": CHROME_UA, "sec-fetch-site": "same-origin", "x-forwarded-for": ip },
      data: JSON.stringify({ p: path, e: true, r: "https://www.google.com/", t: false }),
    });
  }
  await expect.poll(async () => (await viewsFor(path)).length, { timeout: 20_000 }).toBe(3);

  await signIn(page);
  await page.goto("/admin/analytics?range=today");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText(path)).toBeVisible();
  await expect(page.getByText("Google", { exact: true }).first()).toBeVisible();

  // The chart can be read from the keyboard, and says what it is reading.
  const chart = page.getByRole("group", { name: /visitors and page views chart/i });
  await chart.focus();
  await page.keyboard.press("End");
  await expect(chart.locator('[aria-live="polite"]')).toContainText(/visitors, .* page views/);

  // And every number is in a table as well.
  await page.getByText("Show the numbers").click();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
});
