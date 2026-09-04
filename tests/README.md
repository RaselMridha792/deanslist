# Smoke tests

Playwright end-to-end tests for deanslist.live.

They exist for one reason. The entire value proposition of this rebuild is that
**every form reaches the client's own database**. The old site hands that job to
a third-party MachForm iframe on ggnform.com, which is why the business owns none
of its own contestant records. A form that quietly stops writing is not a bug, it
is total product failure — and it is invisible from the outside, because the page
still says thank you.

So no test here is allowed to pass on "the button worked".

---

## Running them

> **`npm test` does not exist yet.** `package.json` has no `"test"` script, so
> every `npm test` in this file is aspirational until the two lines under
> [npm scripts](#npm-scripts) below are added. Until then, run
> `npx playwright test`.

Playwright does **not** start a server. Start one yourself first:

```bash
npm run dev          # terminal 1
npm test             # terminal 2
```

Against a deployment:

```bash
BASE_URL=https://deanslist.vercel.app npm test
```

| Command | What it does |
|---|---|
| `npm test` | the whole suite, headless |
| `npm run test:headed` | the same, in a visible browser |
| `npx playwright test forms.spec.ts` | one file |
| `npx playwright test -g "honeypot"` | one pattern |
| `npx playwright test --ui` | the interactive runner |
| `npx playwright show-report` | the HTML report from the last run |

<a id="npm-scripts"></a>

### npm scripts

These two lines belong in `package.json` under `"scripts"` — they are not added
here because another agent may be editing that file:

```json
    "test": "playwright test",
    "test:headed": "playwright test --headed"
```

---

## What has to be true before they pass

- **A server is running** at `BASE_URL` (default `http://localhost:3000`).
- **The database is reachable and seeded.** `npm run db:seed` creates the OWNER
  account the admin tests sign in with. Note that `src/lib/queries.ts` falls back
  to `src/content/site.ts` when Postgres is unreachable in development, so the
  public pages will still render — but every form test will fail, correctly,
  because `/api/leads` has no such fallback.
- **Admin credentials.** Defaults are the seed's `admin@deanslist.live` /
  `ChangeMe123!`. Override with `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`.
- **`AUTH_SECRET`** — only for the one test that mints a REVIEWER session.
  `playwright.config.ts` loads `.env` automatically when the target is
  localhost. Against a remote deployment, export `AUTH_SECRET` yourself or that
  single test skips (and says so).

---

## ⚠️ These tests write to the database

Every form test submits a real lead. There is no test-mode flag on the API and
adding one would have meant testing a different code path than the public uses.

Rows created here are identifiable:

- the email is always `e2e+<case>-<stamp>@deanslist.test`
- `.test` is reserved by RFC 2606 and can never resolve, so no confirmation email
  can reach a real inbox — though with a live `RESEND_API_KEY` the app will still
  *attempt* a send and log the failure

To find and remove them, filter the dashboard on **`e2e+`**
(`/admin/leads?q=e2e%2B`) and delete. **Point `BASE_URL` at staging, not at the
client's live database**, unless you intend to clean up afterwards.

---

## The three files

### `forms.spec.ts` — the important one

Six public forms, each tested twice.

| Form | Route | Stored as |
|---|---|---|
| Contest entry | `/enter` | `CONTESTANT` |
| Talent pool | `/join#talent-pool` | `FAN` |
| Crew application | `/join#crew` | `CREW` |
| Sponsor enquiry | `/sponsors` | `SPONSOR` |
| Contact | `/contact` | `GENERAL` |
| Newsletter | homepage | `FAN`, source `NEWSLETTER` |

Each happy path asserts three things, and the third is the one that matters:

1. the submission succeeds in a real browser,
2. the visitor lands on the right confirmation,
3. **the row is read back out of the database** through
   `/api/admin/leads/export`, with the correct `LeadType` on it.

Without step 3 this file would pass against an API route that answers
`{ ok: true }` and throws the lead away, which is precisely the failure it is
here to catch.

Each form is then tested with the honeypot filled. The hidden `website` input has
no bounding box, so `fill()` correctly refuses it — a human cannot type there.
The test sets the DOM value instead, which is what a scripted form filler
actually does, and because these forms are uncontrolled and read through
`FormData` on submit, that is exactly what the server receives. The submission is
confirmed to have reached `/api/leads` first, so "nothing in the database" can
never be an artefact of the form failing to submit at all.

**What the honeypot actually does, as shipped.** `src/app/api/leads/route.ts`
intends a silent accept — `if (data.website) return NextResponse.json({ ok: true })`,
no id and no row, so a bot cannot tell it was caught. That branch is unreachable.
`data` is the output of `leadSchema`, and `src/lib/validation.ts` declares the
honeypot as `website: z.string().max(0).optional()`, so a filled honeypot fails
`safeParse` and the route answers `400` twenty lines earlier; `data.website` can
only ever be `""` or `undefined`. `/api/subscribe` is built the same way. The
contract in force is **refusal by the schema**, and that is what these tests
assert.

Two consequences worth knowing. A real visitor whose password manager autofills a
field named `website` sees "Invalid submission" rather than a thank-you page —
which is the argument for moving the honeypot onto the route's silent-accept
branch. And a bot learns from the `400` exactly which field gave it away, which
is the argument the silent accept was written to answer.

So the assertions are deliberately shaped:

- never a `201`, and **never a lead id in the response body** — true under either
  mechanism, and the one thing a bot must not receive;
- on `/api/leads`, a `400` must name `website` **and nothing else**. This is what
  makes the test non-vacuous. "Rejected" on its own is also what a missing
  required field produces, and would still pass with the honeypot deleted from
  the schema outright;
- nothing in the export, read twice a beat apart so a lagging pooled read cannot
  fake a pass;
- and one dedicated **honeypot contract** test posts the same payload twice, once
  with an empty honeypot and once poisoned, against both `/api/leads` and
  `/api/subscribe`. The clean one must be accepted and must appear in the export;
  the poisoned twin must not. `/api/subscribe` answers a bare
  `{ error: "Invalid email" }` with no field breakdown, so that pair is the only
  thing tying its rejection to the honeypot.

`expectHoneypotStopped` accepts **either** mechanism — 400 naming `website`, or
200 with `ok: true` and no id — so fixing the schema so the route's silent accept
actually runs is an improvement that will not turn this suite red. The run
records which mechanism answered as a `honeypot` annotation.

The happy path and the honeypot path differ in one field and nothing else. That
pairing is what keeps both honest: if the read-back always returned nothing the
happy paths would fail, and if it always returned rows the honeypot tests would.

Last test in the file: a flood of eight submissions from one address must be met
with a `429`, and none of the eight may be answered `201`. Every request carries
a poisoned honeypot; `rateLimit()` runs before the body is parsed, so the
honeypot rejection cannot mask a limiter that is not working.

### `smoke.spec.ts` — structure

- All 15 public routes return 200 and render exactly one non-empty `h1`.
- **Zero dead links.** Every internal `href` on every page is crawled and
  fetched; `href="#"`, empty hrefs, `javascript:` hrefs, `skype:#?chat`, empty
  `mailto:`, and in-page anchors whose target does not exist all fail the run.
  The old site carries 42 of these. The classifier is a pure function with its
  own test that feeds it each of those shapes, so it cannot go blind and report
  a clean bill of health.
- **No partial numbers.** The old homepage renders `.7Mil+` for subscribers and a
  bare `K` for Facebook followers, because the counter animates up from an empty
  value and only the suffix survives. A text-node scan catches that anywhere on
  the page rather than being tied to one CSS class — and it too has a test of its
  own, fed the exact broken strings plus well-formed figures like `$1,000` and
  `1.2M` that it must leave alone.
- **Unique element ids, and no orphaned labels.** An id has to be unique in a
  document, because a `<label for>` resolves to the *first* element carrying it.
  This shipped: `/join` renders `LeadForm` twice and the component hardcoded
  `lf-firstName`, `lf-email` and the rest, so clicking the crew form's "First
  name" label focused the talent-pool input a screen and a half further up.
  `LeadForm` now derives its ids from `useId()`; the audit walks all 15 routes so
  the next component cannot repeat it, and it has its own test — fed a duplicated
  id and a label pointing at nothing — so it cannot go blind.
- **Old Joomla URLs.** All nine redirect rules resolve with a 301/308 to the right
  destination, and that destination itself returns 200. `next.config.ts` is
  imported and compared against the covered list, so adding a redirect without
  testing it fails the run.

### `admin.spec.ts` — who can read the database

`/api/admin/leads/export` hands out every contact record the business owns. It is
the most sensitive route in the app, so most of this file is about refusing
people.

- `/admin` and `/admin/leads` redirect anonymous visitors to the login page, with
  `?next=` preserved, and leak no table on the way.
- The export answers `401` to: no session, garbage in the cookie, a well-formed
  OWNER token signed with the wrong secret, and an unsigned `alg:none` token.
- The export also answers `401` to a **CVE-2025-29927** `x-middleware-subrequest`
  bypass attempt. On a patched Next this only proves the header buys nothing; its
  value is as a regression guard, because if that bypass ever works again the
  test can stay green only while the route keeps calling `requireApiRole()` for
  itself.
- Signing in works, and `/admin/leads` renders a submission the test created
  moments earlier — not just an empty table. The same session can then export,
  which is what stops the `401` tests above passing against an export route that
  is simply broken for everyone.
- A REVIEWER sees only **Overview** and **Leads & Entries**; an OWNER sees the
  full navigation. The OWNER half is the counterweight — without it, a nav that
  rendered nothing at all would satisfy the REVIEWER assertion.

The REVIEWER session is minted with `jose` and the real `AUTH_SECRET` rather than
seeded, because the repository ships exactly one user and a test has no business
writing to the client's user table. The cookie goes through the same `jwtVerify`
as any real session.

---

## Two things worth knowing

**Every test claims its own client IP.** `src/lib/rate-limit.ts` keys its
in-memory buckets on `x-forwarded-for`, and `/api/leads` allows five submissions
a minute, so six forms in one run from one address would trip the limiter and
every later test would fail for the wrong reason. Tests send addresses from
`203.0.113.0/24` and `198.51.100.0/24` (reserved for documentation, so they can
never collide with a real visitor).

That works because the app trusts a header the client controls — which also means
a real bot bypasses the rate limit by rotating it. Behind Nginx or Vercel the
header is rewritten by the proxy and this is fine; on a directly exposed origin it
is not. Flagged, not fixed here.

**Serial by default, and no retries.** `workers: 1`, because the rate limiter is
one in-memory `Map` in the server process and a dev server compiling several
routes at once is slow enough to look broken. Override with `PW_WORKERS=4`
against a built deployment. Retries are off deliberately: a retry turns an
intermittent failure green, and an intermittently broken form is the exact thing
this suite exists to surface.

---

## Not covered

Worth stating so nobody assumes otherwise:

- Only Chromium. Firefox and WebKit are not installed; add projects to
  `playwright.config.ts` after `npx playwright install firefox webkit`.
- No visual regression, no accessibility audit, no mobile viewport pass.
- Email delivery is not asserted — `src/lib/mail.ts` no-ops without
  `RESEND_API_KEY`, and sending is fire-and-forget by design.
- The admin content CRUD, campaigns and chatbot surfaces are untested; they were
  not built when this suite was written.
