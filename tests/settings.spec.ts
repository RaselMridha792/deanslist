import { test, expect, type Page } from "playwright/test";

/**
 * Site settings: the values the client owns.
 *
 * The point of the screen is that a link, an ad pixel and the mail key can be
 * changed without a developer. What is worth testing is therefore not the form
 * but its reach: does a link saved here actually appear on the public site,
 * does the pixel stay off until someone consents, and is the key stored in a
 * way that a copied database does not hand over.
 *
 * Local only: it writes rows and reads them back through Prisma.
 */

const TARGET = process.env.BASE_URL ?? "http://localhost:3000";
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(TARGET);

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@deanslist.live";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";

const INSTAGRAM = "https://www.instagram.com/deanslistllc";
const PIXEL_ID = "1234567890123456";
const RESEND_KEY = "re_test_only_0123456789";
const GA_ID = "G-TEST123456";
/** What people actually paste: the snippet from Google's setup screen, not the id. */
const GA_SNIPPET = `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>`;

test.skip(!IS_LOCAL, "writes settings rows; local server only");

/** Own rate-limit bucket, clear of the other spec files. */
let ipCounter = 0;
function nextClientIp(): string {
  ipCounter += 1;
  const worker = Number(process.env.TEST_WORKER_INDEX ?? 0);
  return `198.18.${worker % 100}.${(ipCounter % 250) + 1}`;
}

async function prisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

/**
 * Start each test from no settings at all.
 *
 * Retried once because the developer database is serverless and suspends when
 * idle: the first query of a run can arrive while it is still waking and come
 * back as a connection error. That failure is the database's schedule, not the
 * code under test, and a red run blamed on it costs more to read than the one
 * extra attempt costs to make. A second failure is reported as it happened.
 */
async function clearSettings() {
  for (let attempt = 1; ; attempt++) {
    const db = await prisma();
    try {
      await db.setting.deleteMany({
        where: { key: { in: ["social.instagram", "meta.pixelId", "google.analyticsId", "mail.resendApiKey"] } },
      });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 3000));
    } finally {
      await db.$disconnect();
    }
  }
}

async function signIn(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": nextClientIp() });
  await page.goto("/admin/login");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD);
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/auth/login") && r.request().method() === "POST",
      { timeout: 60_000 },
    ),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  expect(res.status(), "admin sign in").toBe(200);
  await page.waitForURL(/\/admin$/, { timeout: 60_000 });
}

/**
 * Fill the form, save, and do not return until the page says what happened.
 *
 * Two things this has to be careful about. The form is a Client Component, so
 * a click landing before hydration is a plain browser submit: the POST returns
 * 200, the action never runs, and nothing is saved — which is exactly the
 * silent pass this test existed to catch. And a save that is rejected looks
 * identical until the message appears. So it waits for one of the two
 * outcomes and reports which.
 */
async function save(
  page: Page,
  fill: (page: Page) => Promise<void>,
): Promise<"saved" | "rejected"> {
  await page.goto("/admin/settings");
  await page.waitForLoadState("networkidle");
  await fill(page);
  await page.getByRole("button", { name: /save settings/i }).click();

  const saved = page.getByText("Saved", { exact: true });
  const rejected = page.locator("p.error-text");
  await expect(saved.or(rejected)).toBeVisible({ timeout: 30_000 });
  return (await saved.isVisible()) ? "saved" : "rejected";
}

test.beforeEach(clearSettings);
test.afterAll(clearSettings);

test("a link saved in the dashboard reaches the public pages", async ({ page }) => {
  await signIn(page);
  expect(
    await save(page, async (p) => {
      await p.locator("#f-instagram").fill(INSTAGRAM);
    }),
  ).toBe("saved");

  // The footer is on every page; the contact page lists it as a row.
  await page.goto("/");
  await expect(page.locator(`footer a[href="${INSTAGRAM}"]`)).toBeVisible();

  await page.goto("/contact");
  await expect(page.locator(`a[href="${INSTAGRAM}"]`).first()).toBeVisible();

  // And search engines are told about it, through the Organization markup.
  const jsonLd = await page.goto("/").then(() =>
    page.locator('script[type="application/ld+json"]').first().textContent(),
  );
  expect(jsonLd ?? "").toContain(INSTAGRAM);
});

test("a link on the wrong site is refused", async ({ page }) => {
  await signIn(page);
  expect(
    await save(page, async (p) => {
      await p.locator("#f-instagram").fill("https://example.com/not-instagram");
    }),
  ).toBe("rejected");
  await expect(page.locator("p.error-text")).toContainText(/instagram/i);

  const db = await prisma();
  try {
    expect(await db.setting.count({ where: { key: "social.instagram" } })).toBe(0);
  } finally {
    await db.$disconnect();
  }
});

test("the pixel loads only after consent, and the privacy page says so", async ({ page }) => {
  await signIn(page);
  expect(
    await save(page, async (p) => {
      await p.locator("#f-pixelId").fill(PIXEL_ID);
    }),
  ).toBe("saved");

  // Before any choice: a banner, and nothing from Facebook.
  const facebookRequests: string[] = [];
  page.on("request", (r) => {
    if (/facebook\.(net|com)/i.test(r.url())) facebookRequests.push(r.url());
  });

  await page.goto("/");
  const banner = page.getByRole("region", { name: /advertising cookies/i });
  await expect(banner).toBeVisible();
  await page.waitForTimeout(1500);
  expect(facebookRequests, "nothing is loaded before a choice").toHaveLength(0);

  // Declining keeps it that way, and is remembered.
  await banner.getByRole("button", { name: /no thanks/i }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await page.waitForTimeout(1500);
  expect(facebookRequests, "declining is remembered").toHaveLength(0);

  // Accepting loads the pixel.
  await page.evaluate(() => window.localStorage.removeItem("dl_ads_consent"));
  await page.reload();
  // Inside the banner, and exact: "Play PJ Galloway…" also matches /allow/i.
  await page
    .getByRole("region", { name: /advertising cookies/i })
    .getByRole("button", { name: "Allow", exact: true })
    .click();
  await expect
    .poll(() => facebookRequests.length, { timeout: 15_000 })
    .toBeGreaterThan(0);

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Cookies" })).toBeVisible();
  await expect(page.getByText(/Meta Pixel/i).first()).toBeVisible();
});

test("the mail key is stored encrypted and never shown again", async ({ page }) => {
  await signIn(page);
  expect(
    await save(page, async (p) => {
      await p.locator("#f-resendApiKey").fill(RESEND_KEY);
    }),
  ).toBe("saved");

  const db = await prisma();
  try {
    const row = await db.setting.findUnique({ where: { key: "mail.resendApiKey" } });
    expect(row, "the key was saved").not.toBeNull();
    expect(row!.value.startsWith("enc:v1:"), "stored encrypted").toBe(true);
    expect(row!.value).not.toContain(RESEND_KEY);
  } finally {
    await db.$disconnect();
  }

  // The screen shows that a key exists, not what it is.
  await page.goto("/admin/settings");
  const html = await page.content();
  expect(html).not.toContain(RESEND_KEY);
  await expect(page.getByText(/Saved \(re_/)).toBeVisible();
});

test("the Google tag is in the page, with cookies denied until someone allows them", async ({ page }) => {
  // The tag's own script is Google's; what is under test is what this site
  // tells it. Blocking the download leaves the commands queued in dataLayer,
  // where they can be read.
  await page.route("**://www.googletagmanager.com/**", (route) => route.abort());

  await signIn(page);
  expect(
    await save(page, async (p) => {
      await p.locator("#f-gaId").fill(GA_SNIPPET);
    }),
  ).toBe("saved");

  const db = await prisma();
  try {
    const row = await db.setting.findUnique({ where: { key: "google.analyticsId" } });
    expect(row?.value, "the id is taken out of the pasted snippet").toBe(GA_ID);
  } finally {
    await db.$disconnect();
  }

  // In the HTML itself, because that is where Google's setup check looks.
  const html = await (await page.request.get("/")).text();
  expect(html).toContain(`googletagmanager.com/gtag/js?id=${GA_ID}`);

  type Command = [string, string, Record<string, string>?];
  const consent = (kind: "default" | "update") =>
    page.evaluate((k) => {
      const layer = (window as unknown as { dataLayer?: Command[] }).dataLayer ?? [];
      const hit = [...layer].reverse().find((c) => c[0] === "consent" && c[1] === k);
      return hit?.[2]?.analytics_storage ?? null;
    }, kind);

  // No answer yet: denied, and the banner asks about analytics.
  await page.goto("/");
  expect(await consent("default")).toBe("denied");
  const banner = page.getByRole("region", { name: /analytics cookies/i });
  await expect(banner).toBeVisible();

  // Allow updates the tag at once, without a reload.
  await banner.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(banner).toBeHidden();
  expect(await consent("update")).toBe("granted");

  // And a returning visitor starts granted, from the first hit.
  await page.reload();
  expect(await consent("default")).toBe("granted");

  await page.goto("/privacy");
  await expect(page.getByText(/Google Analytics/).first()).toBeVisible();
});

test("an earlier yes to the pixel does not cover Google Analytics", async ({ page }) => {
  await page.route("**://www.googletagmanager.com/**", (route) => route.abort());
  await signIn(page);
  expect(
    await save(page, async (p) => {
      await p.locator("#f-gaId").fill(GA_ID);
    }),
  ).toBe("saved");

  // The value stored before tools were recorded: a bare yes, given to the pixel.
  await page.goto("/");
  await page.evaluate(() => window.localStorage.setItem("dl_ads_consent", "granted"));
  await page.reload();

  await expect(page.getByRole("region", { name: /analytics cookies/i })).toBeVisible();
  const storage = await page.evaluate(() => {
    const layer = (window as unknown as { dataLayer?: unknown[][] }).dataLayer ?? [];
    const hit = layer.find((c) => c[0] === "consent" && c[1] === "default") as
      | [string, string, Record<string, string>]
      | undefined;
    return hit?.[2]?.analytics_storage;
  });
  expect(storage).toBe("denied");
});
