import { test, expect, type Page, type APIRequestContext } from "playwright/test";
import { SignJWT } from "jose";

/**
 * Admin access control.
 *
 * /api/admin/leads/export hands out every contact record the business owns — the
 * entire asset this rebuild exists to create. So the tests here are less about
 * "does the dashboard work" and more about "who can read the database".
 *
 * The project's stated rule is that middleware is a first line of defence only,
 * because it has proven bypassable (CVE-2025-29927), and every admin route
 * re-checks the session itself. That rule is only worth stating if something
 * verifies it, so the bypass header is sent here deliberately.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@deanslist.live";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";

const SESSION_COOKIE = "dl_session";
const EXPORT_PATH = "/api/admin/leads/export";

/**
 * Signing key for the minted-session test below.
 *
 * playwright.config.ts loads .env when the target is this machine, so a real
 * local AUTH_SECRET is normally present; the literal is the dev default from
 * src/lib/env.ts, used only when .env does not set one. Against a deployment
 * there is deliberately no fallback — a guessed key would fail confusingly, so
 * the test skips unless the operator exports AUTH_SECRET themselves.
 */
const DEV_SECRET_FALLBACK = "dev-only-insecure-secret-not-for-production";
const TARGET = process.env.BASE_URL ?? "http://localhost:3000";
const IS_LOCAL_TARGET = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(TARGET);
const AUTH_SECRET = process.env.AUTH_SECRET || (IS_LOCAL_TARGET ? DEV_SECRET_FALLBACK : "");

/**
 * Own rate-limit bucket per test: /api/auth/login allows 8 tries per 5 min per
 * IP.
 *
 * The worker index is in the third octet, and it has to be. Playwright runs
 * spec files in separate processes, so a module-level counter restarts at zero
 * in each one and every worker hands out the SAME sequence of addresses. The
 * workers then share a bucket, and a test that signs in twice starts failing in
 * a full run while passing on its own. tests/forms.spec.ts already carried this
 * fix; this file did not, and that is exactly the flake it produced.
 */
let ipCounter = 0;
function nextClientIp(): string {
  ipCounter += 1;
  const worker = Number(process.env.TEST_WORKER_INDEX ?? 0);
  return `198.51.${100 + (worker % 100)}.${(ipCounter % 250) + 1}`;
}

/** Sign a session cookie the way src/lib/auth.ts does. */
async function mintSession(
  claims: { id: string; email: string; name: string; role: string },
  secret: string,
): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}

/**
 * Sign in and do not return until the session exists.
 *
 * It waits on the POST itself rather than on the URL. The suite runs against
 * `next dev`, where the first hit on a cold route compiles it, and a login that
 * takes longer than the 15s expect timeout used to surface as "still on
 * /admin/login" with no indication of why. Reading the status turns a 401 or a
 * 429 into a message that names the cause, and the wait is bounded by the
 * 90s test timeout instead of the assertion default.
 */
async function signIn(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": nextClientIp() });
  await page.goto("/admin/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);

  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/auth/login") && r.request().method() === "POST",
      { timeout: 60_000 },
    ),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);

  expect(
    res.status(),
    `sign in as ${email} was refused with ${res.status()}. 401 means the account ` +
      "or password is wrong; 429 means the login rate limit was hit, which points " +
      "at nextClientIp handing out a repeated address.",
  ).toBe(200);

  // The handler pushes to /admin after the cookie is set. Callers that navigate
  // immediately would otherwise race it and be bounced back to the login page.
  await page.waitForURL(/\/admin$/, { timeout: 60_000 });
}

/**
 * A REVIEWER account to test role gating against.
 *
 * This used to mint a token for a made-up user id, which stopped working the
 * moment sessions gained revocation: getSession() now reads User.sessionVersion
 * from the row, so a token for an account that does not exist is refused — which
 * is exactly the behaviour that change was for. The test signs in for real
 * instead, which exercises the same path a person does.
 */
const REVIEWER_EMAIL = process.env.E2E_REVIEWER_EMAIL || "reviewer@deanslist.live";
const REVIEWER_PASSWORD = process.env.E2E_REVIEWER_PASSWORD || "ReviewMe123!";

/* ============================================ signed out sees nothing ==== */

test.describe("signed out", () => {
  for (const route of ["/admin", "/admin/leads"]) {
    test(`${route} redirects to the login page`, async ({ page }) => {
      await page.goto(route);

      await expect(page, `${route} did not send an anonymous visitor to the login page`)
        .toHaveURL(/\/admin\/login/);

      // The redirect must carry where the visitor was going, or signing in
      // dumps them somewhere unrelated.
      expect(new URL(page.url()).searchParams.get("next")).toBe(route);

      // And the page behind it must not have leaked on the way past.
      await expect(page.getByRole("heading", { name: /admin sign in/i })).toBeVisible();
      await expect(page.locator("table")).toHaveCount(0);
    });
  }

  test("the leads export refuses an anonymous request", async ({ request }) => {
    const res = await request.get(EXPORT_PATH, { maxRedirects: 0 });

    expect(
      res.status(),
      "the leads export answered an anonymous request with something other than 401",
    ).toBe(401);

    const body = await res.text();
    expect(body, "the export leaked CSV to an anonymous caller").not.toContain("First name");
  });
});

/* ================================================= forged credentials ==== */

test.describe("forged credentials", () => {
  /**
   * Each of these is a plausible attempt to mint an admin session without the
   * signing key. All of them must be worth exactly nothing.
   */
  const forgeries: { name: string; cookie: () => Promise<string> }[] = [
    {
      name: "garbage in the cookie",
      cookie: async () => "not-a-token-at-all",
    },
    {
      name: "a well-formed OWNER token signed with the wrong secret",
      cookie: () =>
        mintSession(
          { id: "forged", email: "attacker@example.com", name: "Attacker", role: "OWNER" },
          "the-attacker-guessed-this-and-guessed-wrong",
        ),
    },
    {
      name: "an alg:none token, unsigned",
      cookie: async () => {
        const b64 = (o: unknown) =>
          Buffer.from(JSON.stringify(o))
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        return `${b64({ alg: "none", typ: "JWT" })}.${b64({
          id: "forged",
          email: "attacker@example.com",
          name: "Attacker",
          role: "OWNER",
          exp: Math.floor(Date.now() / 1000) + 3600,
        })}.`;
      },
    },
  ];

  for (const forgery of forgeries) {
    test(`the leads export refuses ${forgery.name}`, async ({ request }) => {
      const res = await request.get(EXPORT_PATH, {
        maxRedirects: 0,
        headers: { cookie: `${SESSION_COOKIE}=${await forgery.cookie()}` },
      });

      expect(
        res.status(),
        `a forged session (${forgery.name}) was not rejected with 401`,
      ).toBe(401);
      expect(await res.text(), "the export leaked CSV to a forged session").not.toContain(
        "First name",
      );
    });
  }

  /**
   * CVE-2025-29927: a crafted `x-middleware-subrequest` header made Next skip
   * middleware entirely.
   *
   * On a patched Next this asserts the header buys nothing. Its real value is
   * later: docs/PROJECT-BRIEF.md and src/lib/auth.ts both promise that admin
   * routes never rely on middleware for authorisation, and if a future
   * regression makes the header work again, this test can only stay green if
   * the export is still calling requireApiRole() for itself.
   */
  for (const header of [
    "middleware",
    "src/middleware",
    "src/middleware:src/middleware:src/middleware:src/middleware:src/middleware",
  ]) {
    test(`the leads export refuses a middleware bypass (${header.slice(0, 20)}…)`, async ({
      request,
    }) => {
      const res = await request.get(EXPORT_PATH, {
        maxRedirects: 0,
        headers: { "x-middleware-subrequest": header },
      });

      expect(
        res.status(),
        "skipping middleware exposed the leads export — the route is not re-checking the " +
          "session itself, which is the one thing src/lib/auth.ts says it always does",
      ).toBe(401);
      expect(await res.text()).not.toContain("First name");
    });
  }
});

/* ==================================================== signing in works === */

test("signing in works and the leads table renders real data", async ({ page }) => {
  // Seed one known row through the public API, so the table is asserted against
  // a submission this test can name rather than whatever happens to be there.
  // If the table renders but shows nothing, that is still a failure.
  const email = `e2e+admintable-${Date.now().toString(36)}@deanslist.test`;
  const created = await page.request.post("/api/leads", {
    headers: { "x-forwarded-for": nextClientIp() },
    data: {
      type: "CONTESTANT",
      firstName: "AdminTable",
      lastName: "Fixture",
      rulesAccepted: true,
      broadcastConsent: true,
      email,
      talentCategory: "Singer",
      performanceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  });
  expect(created.status(), "could not create the fixture lead").toBe(201);

  await signIn(page);

  await expect(page, "signing in did not land on the dashboard").toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: /overview/i })).toBeVisible();

  await page.goto(`/admin/leads?q=${encodeURIComponent(email)}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/leads/i);

  const table = page.locator("table");
  await expect(table, "the leads table did not render").toBeVisible();
  await expect(
    table.getByText(email),
    "the leads table rendered but the submission is not in it",
  ).toBeVisible();

  // The same session must now be able to export. Without this the 401 tests
  // above could pass against an export route that is simply broken for everyone.
  const exported = await page.request.get(`${EXPORT_PATH}?q=${encodeURIComponent(email)}`);
  expect(exported.status(), "a signed-in OWNER could not export").toBe(200);
  expect(exported.headers()["content-type"]).toContain("text/csv");
  expect(await exported.text()).toContain(email);
});

/* ================================================== role-gated nav ======= */

/**
 * A REVIEWER reads leads and changes their status. Nothing else. The nav is
 * cosmetic — every route re-checks with requireRole() — but a REVIEWER shown a
 * "Team & Roles" link they cannot use is a support call, and a nav that leaks
 * links is usually a sign the role plumbing is not actually wired up.
 *
 * The session is minted rather than seeded because the repository ships exactly
 * one user (an OWNER) and creating a second one would mean this test writing to
 * the client's user table. Minting exercises the identical code path: the cookie
 * is verified by the real jwtVerify with the real secret, and AdminNav reads the
 * role off the verified payload.
 */
test.describe("role-gated navigation", () => {
  test("a REVIEWER sees only Overview and Leads", async ({ context, page, baseURL }) => {
    await signIn(page, REVIEWER_EMAIL, REVIEWER_PASSWORD);

    // A wrong password lands back on the login page. Say which, rather than
    // reporting a confusing missing-link failure further down.
    await expect(
      page,
      `could not sign in as ${REVIEWER_EMAIL}. Seed a REVIEWER account, or set ` +
        "E2E_REVIEWER_EMAIL and E2E_REVIEWER_PASSWORD.",
    ).toHaveURL(/\/admin$/, { timeout: 15_000 });

    const nav = page.locator("aside nav");
    await expect(nav).toBeVisible();

    const labels = (await nav.getByRole("link").allInnerTexts()).map((t) => t.trim());

    expect(
      labels,
      `a REVIEWER was shown ${labels.join(", ")} — everything past Leads is above their role`,
    ).toEqual(["Overview", "Leads & Entries"]);

    for (const forbidden of [
      "Segments",
      "Shows & Events",
      "Content",
      "Campaigns",
      "Chatbot",
      "Team & Roles",
    ]) {
      await expect(
        nav.getByRole("link", { name: forbidden, exact: true }),
        `a REVIEWER can see the ${forbidden} link`,
      ).toHaveCount(0);
    }

    // And the role is what the page believes it is, not just what the nav drew.
    await expect(page.getByText("REVIEWER", { exact: true })).toBeVisible();
  });

  test("an OWNER sees the full navigation", async ({ page }) => {
    // The counterweight. Without it, a nav that rendered nothing at all would
    // make the REVIEWER test above pass for the wrong reason.
    await signIn(page);
    await expect(page).toHaveURL(/\/admin$/);

    const nav = page.locator("aside nav");
    const labels = (await nav.getByRole("link").allInnerTexts()).map((t) => t.trim());

    expect(labels).toContain("Overview");
    expect(labels).toContain("Leads & Entries");
    expect(
      labels,
      "an OWNER cannot see Team & Roles, so the role ranking is not being applied",
    ).toContain("Team & Roles");
    expect(labels.length).toBeGreaterThan(2);
  });
});

/**
 * Deleting a lead.
 *
 * This is the only irreversible action in the dashboard, so it is tested from
 * three directions: that the confirmation cannot be clicked through, that the
 * row actually leaves the database, and that neither control is offered below
 * OWNER. The server action carries requireRole("OWNER") on top of all three,
 * because a hidden button is presentation and not an authorisation boundary.
 *
 * Every row these tests delete is one they created, through the real public
 * endpoint, so they never touch a submission they did not author.
 */
test.describe("deleting a lead", () => {
  async function seedLead(request: APIRequestContext, baseURL: string) {
    const email = `e2e+del-${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 7)}@deanslist.test`;
    const res = await request.post(`${baseURL}/api/leads`, {
      data: {
        type: "GENERAL",
        firstName: "E2Edelete",
        email,
        message: "Created by the delete test.",
        website: "",
      },
      headers: { "x-forwarded-for": nextClientIp() },
    });
    expect(res.status(), "could not seed a lead to delete").toBe(201);
    return email;
  }

  /** Delete one lead through the table, as the signed-in user on `page`. */
  async function deleteViaTable(page: Page, email: string) {
    await page.goto(`/admin/leads?q=${encodeURIComponent(email)}`);
    await page
      .locator("tbody tr", { hasText: email })
      .locator('input[type="checkbox"]')
      .check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.fill("#delete-confirm", "1");
    await page.getByRole("button", { name: /^Delete 1$/ }).click();

    // Assert the outcome the action reported. Without this a refusal shows up
    // only as "the row is still there" twenty seconds later, which points at
    // the wrong thing entirely.
    await expect(
      page.getByText("1 entry deleted."),
      "the delete did not report success",
    ).toBeVisible({ timeout: 20_000 });

    // Re-query rather than trusting the current render: the row has to be gone
    // from the database, not merely from the DOM that just mutated.
    await expect(async () => {
      await page.goto(`/admin/leads?q=${encodeURIComponent(email)}`);
      await expect(page.locator("tbody tr", { hasText: email })).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
  }

  test("an OWNER deletes a lead, and it leaves the database", async ({
    page,
    request,
    baseURL,
  }) => {
    const email = await seedLead(request, baseURL!);

    await signIn(page);
    // signIn clicks and returns; the session lands on the redirect that
    // follows. Navigating before it does races the cookie and bounces to login.
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(`/admin/leads?q=${encodeURIComponent(email)}`);
    const row = page.locator("tbody tr", { hasText: email });
    await expect(row, "the seeded lead is not in the inbox").toHaveCount(1);

    await row.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // The confirm button stays dead until the count is typed correctly. A
    // dialog that can be dismissed by reflex is not a confirmation.
    const confirm = page.getByRole("button", { name: /^Delete 1$/ });
    await expect(confirm, "delete was clickable before confirming").toBeDisabled();

    await page.fill("#delete-confirm", "2");
    await expect(confirm, "the wrong count enabled the delete").toBeDisabled();

    await page.fill("#delete-confirm", "1");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // Deleting the last row on a page is how the empty state is reached, so the
    // confirmation has to survive it. Without this the one action that cannot
    // be undone is also the one that reports nothing.
    await expect(page.getByText("1 entry deleted.")).toBeVisible();

    await expect(async () => {
      await page.goto(`/admin/leads?q=${encodeURIComponent(email)}`);
      await expect(page.locator("tbody tr", { hasText: email })).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
  });

  test("a REVIEWER is never offered the delete control", async ({ page }) => {
    await signIn(page, REVIEWER_EMAIL, REVIEWER_PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/leads");

    const first = page.locator("tbody tr input[type='checkbox']").first();
    if ((await first.count()) === 0) test.skip(true, "no leads to select");
    await first.check();

    await expect(
      page.getByRole("button", { name: "Delete", exact: true }),
      "a REVIEWER was shown the bulk delete control",
    ).toHaveCount(0);
  });

  test("a REVIEWER cannot reach the erasure control on a lead's own page", async ({
    browser,
    page,
    request,
    baseURL,
  }) => {
    const email = await seedLead(request, baseURL!);

    await signIn(page, REVIEWER_EMAIL, REVIEWER_PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(`/admin/leads?q=${encodeURIComponent(email)}`);
    const row = page.locator("tbody tr", { hasText: email });
    await expect(row).toHaveCount(1);
    await row.getByRole("link").first().click();

    await expect(
      page.getByRole("button", { name: /delete this entry/i }),
      "a REVIEWER was offered the erasure control on the lead detail page",
    ).toHaveCount(0);
    await expect(page.getByText("Erasure", { exact: true })).toHaveCount(0);

    // Clean up in a FRESH context. Calling signIn again on this page would not
    // change role: /admin/login redirects a signed-in visitor straight to
    // /admin, so the fill and click never run and the session stays REVIEWER.
    // The delete would then silently do nothing and the failure would point at
    // the wrong thing.
    const ownerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    await signIn(owner);
    await expect(owner).toHaveURL(/\/admin$/);
    await deleteViaTable(owner, email);
    await ownerCtx.close();
  });
});
