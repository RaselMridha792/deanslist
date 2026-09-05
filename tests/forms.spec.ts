import {
  test,
  expect,
  request as newRequest,
  type APIRequestContext,
  type Locator,
  type Page,
} from "playwright/test";

/**
 * THE TEST THAT JUSTIFIES THE REBUILD.
 *
 * The old site hands every form to a third-party MachForm iframe on
 * ggnform.com, which is exactly why the client owns no contestant records. The
 * one thing this project promises is that every form reaches the client's own
 * database. A form that silently stops writing is not a bug, it is total product
 * failure, and it is invisible from the outside: the page still says thank you.
 *
 * So a green result here is never allowed to mean "the button worked". Every
 * happy path asserts THREE things:
 *
 *   1. the submission succeeds in the browser,
 *   2. the visitor lands on the right confirmation,
 *   3. the row is READ BACK OUT OF THE DATABASE, through the admin export, with
 *      the correct LeadType on it.
 *
 * Step 3 is the whole point. Without it this file passes against an API route
 * that answers `{ ok: true }` and throws the lead away.
 *
 * The honeypot cases get the same treatment, for the same reason. "The request
 * was rejected" is not an assertion about the honeypot — a rejection for a
 * missing field looks identical from the outside, and would survive the honeypot
 * being deleted. Every honeypot case here therefore asserts WHAT rejected it,
 * and one test at the bottom submits the same payload twice, once clean and once
 * poisoned, so the difference in outcome can only be the honeypot. See the
 * "honeypot contract" block below for what the app actually does today, which is
 * not what the route's comment claims.
 */

/* ------------------------------------------------------------------ setup */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@deanslist.live";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";

/**
 * A distinct client IP per test.
 *
 * src/lib/rate-limit.ts keys its in-memory buckets on `x-forwarded-for`, and
 * /api/leads allows five submissions a minute. Six forms in one run from one
 * address would trip it and every later test would fail for the wrong reason.
 * Addresses come from 203.0.113.0/24 (TEST-NET-3, reserved for documentation)
 * so they can never collide with a real visitor.
 *
 * Worth stating plainly: this works because the app trusts a header the client
 * controls, which also means a real bot bypasses the rate limit by rotating it.
 * See tests/README.md.
 */
let ipCounter = 0;
/**
 * A fresh client address per request, unique across parallel workers.
 *
 * The worker index is in the third octet on purpose. Playwright runs spec files
 * in separate processes, so a module-level counter restarts at zero in each one
 * and every worker produced the SAME address sequence — which meant two files
 * sharing a rate-limit bucket, and a honeypot test failing in a full run while
 * passing on its own. That is a test-harness collision, not an application bug,
 * but it makes the suite lie either way.
 */
function nextClientIp(): string {
  ipCounter += 1;
  const worker = Number(process.env.TEST_WORKER_INDEX ?? 0);
  return `203.0.${100 + (worker % 100)}.${(ipCounter % 250) + 1}`;
}

/** Unique per run, so an assertion can never match a leftover row. */
let idCounter = 0;
function identity(tag: string) {
  idCounter += 1;
  const stamp = `${Date.now().toString(36)}${idCounter}${Math.random().toString(36).slice(2, 6)}`;
  return {
    stamp,
    firstName: `E2E${tag}`,
    lastName: `Case${stamp.slice(-4)}`,
    // .test is reserved by RFC 2606 and can never resolve, so no confirmation
    // email can reach a real inbox. The e2e+ prefix makes cleanup a one-filter
    // job: /admin/leads?q=e2e%2B
    email: `e2e+${tag}-${stamp}@deanslist.test`,
  };
}

/* --------------------------------------------------- reading the database */

/**
 * The only honest way to check a write landed, short of opening Postgres: sign
 * in and read the leads back out through the admin export. One login per worker
 * — /api/auth/login allows eight attempts per five minutes per IP.
 */
let adminSession: Promise<APIRequestContext> | null = null;

function admin(baseURL: string): Promise<APIRequestContext> {
  adminSession ??= (async () => {
    const ctx = await newRequest.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.254" },
    });

    const res = await ctx.post("/api/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    if (!res.ok()) {
      throw new Error(
        `Admin sign-in failed with ${res.status()}. These tests read submissions back ` +
          `out of the database through the admin export, so they need a working login. ` +
          `Run \`npm run db:seed\`, or set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.`,
      );
    }
    return ctx;
  })();

  return adminSession;
}

/**
 * Every export row whose text contains this email. The export is CSV with one
 * header line and CRLF endings; every cell is quoted, so `"CONTESTANT"` is an
 * unambiguous substring test for the lead type column.
 */
async function exportRowsFor(baseURL: string, email: string): Promise<string[]> {
  const ctx = await admin(baseURL);
  const path = `/api/admin/leads/export?q=${encodeURIComponent(email)}`;

  // A Next dev server recompiling in the background answers 404 for a beat while
  // a route is rebuilt, and that is not a product defect. Retried a few times,
  // then reported with the status attached — a route that is genuinely gone
  // still fails, and says exactly what it answered.
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await ctx.get(path);
    status = res.status();

    if (status === 200) {
      const csv = await res.text();
      return csv
        .split("\r\n")
        .slice(1)
        .filter((line) => line.includes(email));
    }

    // 401/403 is a real answer about authorisation; do not paper over it.
    if (status === 401 || status === 403) break;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  expect(
    status,
    `the admin leads export answered ${status} for a signed-in session — without a ` +
      `working export this suite cannot prove anything reached the database`,
  ).toBe(200);

  return [];
}

/** Assert the submission is in the client's own database, with the right type. */
async function expectStoredLead(
  baseURL: string,
  email: string,
  expected: { type: string; firstName: string; source?: string },
) {
  // Polled rather than read once: a hosted Postgres behind a pooler (this app
  // carries both DATABASE_URL and DIRECT_URL) can serve a read a beat behind the
  // write that the API route already committed.
  await expect
    .poll(async () => (await exportRowsFor(baseURL, email)).length, {
      message: `no lead with ${email} reached the database — the form reported success but nothing was written`,
      timeout: 15_000,
      intervals: [250, 500, 1000, 2000],
    })
    .toBe(1);

  const [row] = await exportRowsFor(baseURL, email);

  expect(row, `the stored lead must carry type ${expected.type}`).toContain(
    `"${expected.type}"`,
  );
  expect(row, "the stored lead must carry the submitted name").toContain(expected.firstName);
  if (expected.source) {
    expect(row, `the stored lead must record source ${expected.source}`).toContain(
      `"${expected.source}"`,
    );
  }
}

/**
 * Assert nothing was written. Used for every honeypot case.
 *
 * Read twice, a beat apart. The route commits before it answers, so one read is
 * usually enough — but this app carries both DATABASE_URL and DIRECT_URL, and a
 * pooled read can lag the write that produced it. A honeypot test that passes
 * because it looked too early is precisely the false green this file exists to
 * prevent.
 */
async function expectNoStoredLead(baseURL: string, email: string) {
  for (const pause of [0, 2000]) {
    if (pause) await new Promise((r) => setTimeout(r, pause));
    const rows = await exportRowsFor(baseURL, email);
    expect(
      rows,
      `a submission with the honeypot filled reached the database as a lead (${email}). ` +
        `The honeypot is the only thing standing between this database and bot signups.`,
    ).toHaveLength(0);
  }
}

/* ------------------------------------------------------- honeypot contract */

/**
 * WHAT THE HONEYPOT ACTUALLY DOES, AS SHIPPED. Read this before changing any
 * honeypot assertion below.
 *
 * src/app/api/leads/route.ts intends a silent accept, so a bot cannot tell it
 * was caught:
 *
 *     // honeypot filled means bot
 *     if (data.website) return NextResponse.json({ ok: true });   // no id, no row
 *
 * That branch is unreachable. `data` is the OUTPUT of `leadSchema`, and
 * src/lib/validation.ts declares the honeypot as
 *
 *     website: z.string().max(0).optional()
 *
 * so a filled honeypot fails `safeParse` and the route answers 400 twenty lines
 * earlier. `data.website` can only ever be `""` or `undefined`, both falsy.
 * /api/subscribe is built the same way. The shipped contract is therefore
 * REFUSAL BY THE SCHEMA, not a silent accept.
 *
 * `expectHoneypotStopped` accepts either mechanism — moving the honeypot onto
 * the route's silent-accept branch (drop `.max(0)`, let the route catch it) is a
 * real improvement and must not turn this suite red — but it refuses anything
 * else, and for /api/leads it insists a 400 names `website` AND NOTHING ELSE.
 *
 * That last part is the point. "not 201" is satisfied by a rejection for a
 * missing required field, and would still be satisfied with the honeypot deleted
 * from the schema outright. Naming the field ties the rejection to the honeypot.
 * /api/subscribe answers a bare `{ error: "Invalid email" }` with no field
 * breakdown, so attribution there is proved the other way, by the control/poison
 * pair in the "honeypot contract" test at the bottom of this file.
 */

/** What a scripted form filler drops into the field. */
const BOT_PAYLOAD = "https://cheap-seo-backlinks.example";

/** Satisfied by both a browser `Response` and an `APIResponse`. */
type JsonAnswer = { status(): number; json(): Promise<unknown> };

type HoneypotMechanism = "refused-by-schema" | "silently-accepted";

type LeadApiBody = {
  ok?: boolean;
  id?: string;
  error?: string;
  issues?: Record<string, string[]>;
};

/**
 * Assert a poisoned submission was stopped, and report which mechanism stopped
 * it. Pass `namesTheField: false` for /api/subscribe, which returns no field
 * breakdown to check against.
 */
async function expectHoneypotStopped(
  response: JsonAnswer,
  where: string,
  { namesTheField = true }: { namesTheField?: boolean } = {},
): Promise<HoneypotMechanism> {
  const status = response.status();
  const body = ((await response.json().catch(() => ({}))) ?? {}) as LeadApiBody;

  // True under both mechanisms, and the one thing a bot must never receive.
  expect(
    body.id,
    `${where}: answered with a lead id (${body.id}), so a bot's row was written`,
  ).toBeUndefined();

  if (status === 400) {
    if (namesTheField) {
      expect(
        Object.keys(body.issues ?? {}),
        `${where}: rejected with 400, but not because of the honeypot. A rejection for ` +
          `some other field is an ordinary validation failure — it would happen with the ` +
          `honeypot deleted from src/lib/validation.ts, so it proves nothing about the ` +
          `honeypot. Body: ${JSON.stringify(body)}`,
      ).toEqual(["website"]);
    }
    return "refused-by-schema";
  }

  if (status === 200) {
    expect(body.ok, `${where}: answered 200 without ok:true`).toBe(true);
    return "silently-accepted";
  }

  throw new Error(
    `${where}: answered ${status}. A poisoned submission must either be refused by the ` +
      `schema (400 naming "website" and nothing else) or silently accepted by the route ` +
      `(200, ok:true, no id). ${status} is neither` +
      (status === 201 ? " — and 201 means the bot is now in the client's database." : "."),
  );
}

/* ------------------------------------------------------------- page setup */

/** Give this test its own rate-limit bucket before anything is loaded. */
async function isolate(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": nextClientIp() });
}

/**
 * Fill the hidden honeypot the way a bot would.
 *
 * The input is `absolute h-0 w-0 opacity-0`, so it has no bounding box and
 * `fill()` would refuse it — correctly, since a human cannot type into it. A
 * scripted form filler sets the DOM value instead, and because these forms are
 * uncontrolled and read through FormData on submit, setting `.value` is exactly
 * what the server sees. This is the real attack, not a simulation of it.
 */
async function poisonHoneypot(form: Locator) {
  const honeypot = form.locator('input[name="website"]');

  await expect(
    honeypot,
    "this form has no honeypot field — every public form needs one",
  ).toHaveCount(1);
  await expect(
    honeypot,
    "the honeypot must be invisible to people, or real visitors will fill it in and be rejected",
  ).toBeHidden();

  await honeypot.evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, BOT_PAYLOAD);
}

/**
 * Submit and wait for the API call to actually happen.
 *
 * This guard is what stops a honeypot test passing vacuously. Without it, a
 * missing required field would block submission entirely, no row would be
 * written, and "nothing in the database" would look like the honeypot working.
 */
async function submitAndCaptureApiCall(page: Page, submit: Locator, endpoint: string) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes(endpoint) && r.request().method() === "POST",
      { timeout: 30_000 },
    ),
    submit.click(),
  ]);
  return response;
}

test.afterAll(async () => {
  if (!adminSession) return;
  await adminSession.then((ctx) => ctx.dispose()).catch(() => undefined);
  adminSession = null;
});

/* ============================================================== /enter ==== */

test.describe("contest entry form — /enter", () => {
  test("an entry submits, confirms, and is stored as a CONTESTANT", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const me = identity("entry");

    await page.goto("/enter");

    const form = page.locator("form").first();
    await form.locator('input[name="firstName"]').fill(me.firstName);
    await form.locator('input[name="lastName"]').fill(me.lastName);
    await form.locator('input[name="email"]').fill(me.email);
    await form.locator('input[name="country"]').fill("Test Republic");
    await form.locator('select[name="talentCategory"]').selectOption("Singer");
    await form
      .locator('input[name="performanceUrl"]')
      .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await form.locator('textarea[name="message"]').fill("Playwright smoke entry.");

    await form.getByRole("button", { name: /submit my entry/i }).click();

    // 1. lands on the right confirmation, with the contestant-specific copy
    await expect(page).toHaveURL(/\/thank-you\?from=contestant/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/entry received/i);

    // 2. and is actually in the client's database
    await expectStoredLead(baseURL!, me.email, {
      type: "CONTESTANT",
      firstName: me.firstName,
    });
  });

  test("a honeypot-filled entry never becomes a lead", async ({ page, baseURL }) => {
    await isolate(page);
    const bot = identity("entrybot");

    await page.goto("/enter");

    const form = page.locator("form").first();
    // Identical to the passing case above in every respect but the honeypot, so
    // a difference in outcome can only be the honeypot.
    await form.locator('input[name="firstName"]').fill(bot.firstName);
    await form.locator('input[name="email"]').fill(bot.email);
    await form.locator('select[name="talentCategory"]').selectOption("Singer");
    await form
      .locator('input[name="performanceUrl"]')
      .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await poisonHoneypot(form);

    const response = await submitAndCaptureApiCall(
      page,
      form.getByRole("button", { name: /submit my entry/i }),
      "/api/leads",
    );

    await expectHoneypotStopped(response, "/enter → POST /api/leads");
    await expectNoStoredLead(baseURL!, bot.email);
  });
});

/* ============================================ /join — talent pool form ==== */

/**
 * /join carries TWO forms. They are separate funnels — the talent pool is the
 * standing roster the old MachForm actually fed, and the crew form is the
 * production application the signed scope asks for — so both are tested, and
 * both are scoped by their section rather than by element id.
 *
 * (Scoping by section is the right habit anyway, but it used to be forced:
 * LeadForm hardcoded ids like `lf-firstName`, so rendering it twice shipped the
 * same id twice and clicking the crew form's "First name" label focused the
 * talent-pool input further up the page. LeadForm now derives its ids from
 * useId(); the duplicate-id audit in smoke.spec.ts holds that line.)
 */
test.describe("talent pool form — /join", () => {
  test("a talent pool signup submits, confirms, and is stored as a FAN", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const me = identity("talent");

    await page.goto("/join");

    const form = page.locator("#talent-pool form");
    await form.locator('input[name="firstName"]').fill(me.firstName);
    await form.locator('input[name="lastName"]').fill(me.lastName);
    await form.locator('input[name="email"]').fill(me.email);
    await form.locator('input[name="country"]').fill("Test Republic");
    await form.locator('select[name="talentCategory"]').selectOption("DJ");
    await form.locator('textarea[name="message"]').fill("Playwright talent pool signup.");

    await form.getByRole("button", { name: /join the talent pool/i }).click();

    await expect(page).toHaveURL(/\/thank-you\?from=fan/);

    /**
     * The wording is deliberately NOT pinned here.
     *
     * `from=fan` has no entry in the COPY map in src/app/thank-you/page.tsx, so a
     * talent-pool signup falls through to the generic "Message received" written
     * for the contact form. That is a copy gap, reported separately — not a
     * broken form. Asserting the current generic wording would lock the gap in;
     * asserting the wording that should replace it would fail until it lands.
     *
     * What must hold either way: the visitor is told something. A confirmation
     * page with an empty heading reads as a failed submission, which for this
     * form means a talent-pool signup that thinks it did not go through.
     */
    const confirmation = page.getByRole("heading", { level: 1 });
    await expect(confirmation).toBeVisible();
    expect(
      (await confirmation.innerText()).trim(),
      "the talent-pool confirmation renders an empty h1",
    ).not.toBe("");

    await expectStoredLead(baseURL!, me.email, { type: "FAN", firstName: me.firstName });
  });

  test("a honeypot-filled talent pool signup never becomes a lead", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const bot = identity("talentbot");

    await page.goto("/join");

    const form = page.locator("#talent-pool form");
    await form.locator('input[name="firstName"]').fill(bot.firstName);
    await form.locator('input[name="email"]').fill(bot.email);
    await form.locator('select[name="talentCategory"]').selectOption("DJ");
    await poisonHoneypot(form);

    const response = await submitAndCaptureApiCall(
      page,
      form.getByRole("button", { name: /join the talent pool/i }),
      "/api/leads",
    );

    await expectHoneypotStopped(response, "/join#talent-pool → POST /api/leads");
    await expectNoStoredLead(baseURL!, bot.email);
  });
});

/* ================================================== /join — crew form ==== */

test.describe("crew application form — /join", () => {
  test("a crew application submits, confirms, and is stored as CREW", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const me = identity("crew");

    await page.goto("/join");

    // The crew form follows the design: one "Full name", a required Role, and a
    // required "Location" that the server splits back into city and country.
    const form = page.locator("#crew form");
    await form.locator('input[name="fullName"]').fill(`${me.firstName} ${me.lastName}`);
    await form.locator('input[name="email"]').fill(me.email);
    await form.locator('select[name="role"]').selectOption("Judge");
    await form.locator('input[name="location"]').fill("Lagos, Nigeria");
    await form.locator('textarea[name="message"]').fill("Playwright crew application.");

    await form.getByRole("button", { name: /send application/i }).click();

    // The design confirms in place rather than redirecting, so the success
    // panel is the assertion, not a URL change.
    await expect(form.locator("..").getByText(/your application is with the production team/i))
      .toBeVisible({ timeout: 15_000 });

    await expectStoredLead(baseURL!, me.email, { type: "CREW", firstName: me.firstName });
  });

  test("a honeypot-filled crew application never becomes a lead", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const bot = identity("crewbot");

    await page.goto("/join");

    const form = page.locator("#crew form");
    await form.locator('input[name="fullName"]').fill(`${bot.firstName} ${bot.lastName}`);
    await form.locator('input[name="email"]').fill(bot.email);
    await form.locator('select[name="role"]').selectOption("Judge");
    await form.locator('input[name="location"]').fill("Lagos, Nigeria");
    await form.locator('textarea[name="message"]').fill("Bot.");
    await poisonHoneypot(form);

    const response = await submitAndCaptureApiCall(
      page,
      form.getByRole("button", { name: /send application/i }),
      "/api/leads",
    );

    await expectHoneypotStopped(response, "/join#crew → POST /api/leads");
    await expectNoStoredLead(baseURL!, bot.email);
  });
});

/* ============================================================ /sponsors === */

test.describe("sponsor enquiry form — /sponsors", () => {
  test("a sponsor enquiry submits, confirms, and is stored as SPONSOR", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const me = identity("sponsor");

    await page.goto("/sponsors");

    const form = page.locator("form").first();
    await form.locator('input[name="firstName"]').fill(me.firstName);
    await form.locator('input[name="lastName"]').fill(me.lastName);
    await form.locator('input[name="email"]').fill(me.email);
    await form.locator('input[name="company"]').fill("Playwright Beverages Ltd");
    await form.locator('textarea[name="message"]').fill("Playwright sponsor enquiry.");

    await form.getByRole("button", { name: /send enquiry/i }).click();

    await expect(page).toHaveURL(/\/thank-you\?from=sponsor/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/enquiry received/i);

    await expectStoredLead(baseURL!, me.email, { type: "SPONSOR", firstName: me.firstName });
  });

  test("a honeypot-filled sponsor enquiry never becomes a lead", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const bot = identity("sponsorbot");

    await page.goto("/sponsors");

    const form = page.locator("form").first();
    await form.locator('input[name="firstName"]').fill(bot.firstName);
    await form.locator('input[name="email"]').fill(bot.email);
    await poisonHoneypot(form);

    const response = await submitAndCaptureApiCall(
      page,
      form.getByRole("button", { name: /send enquiry/i }),
      "/api/leads",
    );

    await expectHoneypotStopped(response, "/sponsors → POST /api/leads");
    await expectNoStoredLead(baseURL!, bot.email);
  });
});

/* ============================================================= /contact === */

test.describe("contact form — /contact", () => {
  test("a contact message submits, confirms, and is stored as GENERAL", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const me = identity("contact");

    await page.goto("/contact");

    const form = page.locator("form").first();
    // The redesign collapsed first/last into one "name" field and renamed the
    // routed-inquiry select to "type". The server still splits it into
    // firstName/lastName, which is what the export assertion below checks.
    await form.locator('input[name="name"]').fill(`${me.firstName} ${me.lastName}`);
    await form.locator('input[name="email"]').fill(me.email);
    await form.locator('input[name="subject"]').fill("Automated check");
    await form.locator('select[name="type"]').selectOption({ index: 1 });
    await form.locator('textarea[name="message"]').fill("Playwright contact message.");

    await form.getByRole("button", { name: /send message/i }).click();

    await expect(page).toHaveURL(/\/thank-you\?from=general/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/message received/i);

    await expectStoredLead(baseURL!, me.email, { type: "GENERAL", firstName: me.firstName });
  });

  test("a honeypot-filled contact message never becomes a lead", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const bot = identity("contactbot");

    await page.goto("/contact");

    const form = page.locator("form").first();
    await form.locator('input[name="name"]').fill(`${bot.firstName} ${bot.lastName}`);
    await form.locator('input[name="email"]').fill(bot.email);
    await form.locator('input[name="subject"]').fill("Bot");
    await form.locator('textarea[name="message"]').fill("Bot.");
    await poisonHoneypot(form);

    const response = await submitAndCaptureApiCall(
      page,
      form.getByRole("button", { name: /send message/i }),
      "/api/leads",
    );

    await expectHoneypotStopped(response, "/contact → POST /api/leads");
    await expectNoStoredLead(baseURL!, bot.email);
  });
});

/* ======================================== newsletter form — homepage ===== */

/**
 * The business problem behind the whole rebuild is a rented audience. This form
 * is the one that converts a viewer into a contact the client owns, so it gets
 * the same treatment as the entry form.
 */
test.describe("newsletter form — homepage", () => {
  test("a newsletter signup succeeds and is stored with source NEWSLETTER", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const me = identity("news");

    await page.goto("/");

    const form = page.locator("form").filter({ has: page.locator("#nl-email-homepage") });
    await form.locator("#nl-name-homepage").fill(me.firstName);
    await form.locator("#nl-email-homepage").fill(me.email);
    await form.getByRole("button", { name: /notify me/i }).click();

    // No redirect here by design: the form swaps itself for a success state so
    // the visitor keeps their place on the page. Asserting on the page rather
    // than inside `form`, because the form element is what gets replaced.
    await expect(page.getByText(/on the list/i)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await expectStoredLead(baseURL!, me.email, {
      type: "FAN",
      firstName: me.firstName,
      source: "NEWSLETTER",
    });
  });

  test("a honeypot-filled newsletter signup never becomes a lead", async ({
    page,
    baseURL,
  }) => {
    await isolate(page);
    const bot = identity("newsbot");

    await page.goto("/");

    const form = page.locator("form").filter({ has: page.locator("#nl-email-homepage") });
    await form.locator("#nl-email-homepage").fill(bot.email);
    await poisonHoneypot(form);

    const response = await submitAndCaptureApiCall(
      page,
      form.getByRole("button", { name: /notify me/i }),
      "/api/subscribe",
    );

    // /api/subscribe returns no field breakdown, so the rejection cannot be
    // attributed to the honeypot from this response alone. The control/poison
    // pair in "honeypot contract" below is what ties it to the honeypot.
    await expectHoneypotStopped(response, "homepage → POST /api/subscribe", {
      namesTheField: false,
    });
    await expectNoStoredLead(baseURL!, bot.email);
  });
});

/* ============================================================ hardening === */

/**
 * THE HONEYPOT, PROVED RATHER THAN ASSUMED.
 *
 * The six per-form tests above prove a bot's DOM-level attack reaches the
 * endpoint and is stopped, and that /api/leads blames the honeypot when it says
 * no. This test proves the causation directly: two submissions that differ in
 * exactly one field. The clean one must be accepted and must land in the
 * database; the poisoned twin must not.
 *
 * Delete `website` from the schemas in src/lib/validation.ts and the poisoned
 * request is accepted like its twin — 201, a lead id, a row in the export — and
 * every assertion in the second half of this test fails. That is the property
 * the previous version of this suite did not have: it asserted "not 201", got a
 * 400 for whatever reason the schema happened to produce, and would have stayed
 * green with the honeypot removed.
 */
test.describe("honeypot contract", () => {
  test("two identical submissions, one poisoned: only the clean one becomes a lead", async ({
    playwright,
    baseURL,
  }) => {
    const clean = identity("hpclean");
    const bot = identity("hpbot");
    const cleanNews = identity("hpnews");
    const botNews = identity("hpnewsbot");

    const ctx = await playwright.request.newContext({
      baseURL,
      // Its own bucket, and away from the flood test's .251 and the admin
      // session's .254. rateLimit() keys `lead:` and `sub:` separately, so two
      // requests to each endpoint stay well inside the five-a-minute allowance.
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.252" },
    });

    /** Identical but for `website` and the address the row is found by. */
    const entry = (who: { firstName: string; email: string }, website: string) => ({
      type: "CONTESTANT",
      firstName: who.firstName,
      email: who.email,
      country: "Test Republic",
      talentCategory: "Singer",
      performanceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      message: "Playwright honeypot control.",
      website,
    });

    try {
      /* ------------------------------------------------------- /api/leads */

      const accepted = await ctx.post("/api/leads", { data: entry(clean, "") });
      expect(
        accepted.status(),
        `the control submission — the same payload with an EMPTY honeypot — answered ` +
          `${accepted.status()}. Until that one is accepted, nothing below can be ` +
          `attributed to the honeypot.`,
      ).toBe(201);
      await expectStoredLead(baseURL!, clean.email, {
        type: "CONTESTANT",
        firstName: clean.firstName,
      });

      const refused = await ctx.post("/api/leads", { data: entry(bot, BOT_PAYLOAD) });
      const leadMechanism = await expectHoneypotStopped(refused, "POST /api/leads");
      await expectNoStoredLead(baseURL!, bot.email);

      /* --------------------------------------------------- /api/subscribe */

      const acceptedSub = await ctx.post("/api/subscribe", {
        data: { firstName: cleanNews.firstName, email: cleanNews.email, website: "" },
      });
      expect(
        acceptedSub.status(),
        `the newsletter control submission answered ${acceptedSub.status()} rather than 201, ` +
          `so the poisoned one below proves nothing`,
      ).toBe(201);
      await expectStoredLead(baseURL!, cleanNews.email, {
        type: "FAN",
        firstName: cleanNews.firstName,
        source: "NEWSLETTER",
      });

      const refusedSub = await ctx.post("/api/subscribe", {
        data: { firstName: botNews.firstName, email: botNews.email, website: BOT_PAYLOAD },
      });
      const subMechanism = await expectHoneypotStopped(refusedSub, "POST /api/subscribe", {
        namesTheField: false,
      });
      await expectNoStoredLead(baseURL!, botNews.email);

      // Recorded rather than asserted: both mechanisms are acceptable, and a run
      // should say plainly which one is live rather than leaving it to be
      // rediscovered by reading the schema.
      test.info().annotations.push({
        type: "honeypot",
        description: `/api/leads: ${leadMechanism}; /api/subscribe: ${subMechanism}`,
      });
    } finally {
      await ctx.dispose();
    }
  });
});


/**
 * The lead endpoint is public, unauthenticated, and writes to the database, so
 * it is the obvious target for a signup flood. Every request here carries a
 * poisoned honeypot, so the limiter is exercised without a single row reaching
 * the client's database — `rateLimit()` runs before the body is even parsed, so
 * the honeypot rejection does not hide the limiter, and the count of 201s below
 * proves the flood wrote nothing.
 */
test("the public lead endpoint rate limits a flood from one address", async ({
  playwright,
  baseURL,
}) => {
  const ctx = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": "203.0.113.251" },
  });

  const statuses: number[] = [];
  for (let i = 0; i < 8; i++) {
    const res = await ctx.post("/api/leads", {
      data: {
        type: "CONTESTANT",
        firstName: "Flood",
        email: `e2e+flood-${i}-${Date.now()}@deanslist.test`,
        website: BOT_PAYLOAD,
      },
    });
    statuses.push(res.status());
  }
  await ctx.dispose();

  expect(
    statuses,
    `eight rapid submissions from one address produced ${statuses.join(", ")} — ` +
      `none of them a 429, so rateLimit() is not protecting /api/leads`,
  ).toContain(429);

  expect(
    statuses.slice(0, 3).every((s) => s !== 429),
    "the limiter fired on the very first requests, which would block real visitors",
  ).toBe(true);

  expect(
    statuses.filter((s) => s === 201),
    `the flood was answered ${statuses.join(", ")} — every request carried a poisoned ` +
      `honeypot, so not one of them should have been written as a lead`,
  ).toHaveLength(0);
});
