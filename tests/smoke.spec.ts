import { test, expect, type Page } from "playwright/test";

/**
 * Structural smoke tests for the public site.
 *
 * Three of the four things checked here are direct answers to measured defects
 * on the old deanslist.live, recorded in docs/SITE-AUDIT.md:
 *
 *   - 42 `href="#"` links that go nowhere, including "Contact Us";
 *   - a stats band that renders ".7Mil+" and a bare "K" because it animates up
 *     from an empty value and only the suffix survives;
 *   - seven Joomla URLs with existing search ranking that must not 404 on
 *     cutover.
 *
 * "Zero dead links" is not a state you reach once. It is a state a test holds.
 */

/**
 * Every public route. Fifteen, matching the routes shipped in Phase 3 and 4.
 * The two dynamic ones use slugs that are load-bearing elsewhere:
 * `/winners/pj-galloway` is the destination of a Joomla redirect, so it cannot
 * be allowed to quietly disappear.
 */
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/shows",
  "/shows/drop-that-mike",
  "/winners",
  "/winners/pj-galloway",
  "/watch",
  "/enter",
  "/join",
  "/sponsors",
  "/rules",
  "/contact",
  "/thank-you",
  "/privacy",
  "/terms",
] as const;

/* ============================================== every route is alive ===== */

test.describe("public routes", () => {
  test("the route list has not silently shrunk", () => {
    // A guard on the guard. If a page is deleted, someone has to delete its
    // entry here too, and that edit is visible in review.
    expect(PUBLIC_ROUTES).toHaveLength(15);
  });

  for (const route of PUBLIC_ROUTES) {
    test(`${route} returns 200 and renders its h1`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response, `no response at all for ${route}`).not.toBeNull();
      expect(response!.status(), `${route} did not return 200`).toBe(200);

      const h1 = page.locator("h1");

      // Exactly one. Zero means the page renders without a heading; more than
      // one is a document-outline bug and an SEO one.
      await expect(h1, `${route} should have exactly one h1`).toHaveCount(1);

      const heading = (await h1.innerText()).trim();
      expect(heading, `${route} renders an empty h1`).not.toBe("");
    });
  }
});

/* ==================================================== zero dead links ==== */

type FoundLink = {
  href: string;
  text: string;
  /** null unless this is an in-page `#anchor`; then: does the target exist? */
  resolvedAnchor: boolean | null;
};

async function linksOn(page: Page): Promise<FoundLink[]> {
  return page.evaluate(() => {
    const out: FoundLink[] = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      let resolvedAnchor: boolean | null = null;

      if (href.startsWith("#") && href.length > 1) {
        const id = decodeURIComponent(href.slice(1));
        resolvedAnchor = Boolean(
          document.getElementById(id) ||
            document.querySelector(`[name="${CSS.escape(id)}"]`),
        );
      }

      out.push({
        href,
        text: (a.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
        resolvedAnchor,
      });
    });
    return out;
  });
}

type Classification =
  | { kind: "dead"; reason: string }
  | { kind: "internal"; target: string }
  | { kind: "external"; href: string }
  | { kind: "ignored" };

/**
 * Decide what a single href is. Pulled out as a pure function so the rules can
 * be proved against the old site's actual link shapes below, rather than being
 * trusted. A crawler that classifies everything as "ignored" reports zero dead
 * links forever.
 */
function classifyLink(link: FoundLink, pageUrl: string, origin: string): Classification {
  const { href } = link;

  // The old site's signature defect: 42 of these, "Contact Us" among them.
  if (href.trim() === "" || href.trim() === "#") {
    return { kind: "dead", reason: "placeholder href" };
  }
  if (/^javascript:/i.test(href)) {
    return { kind: "dead", reason: "javascript: href" };
  }

  // And six `skype:#?chat` links that went nowhere either.
  if (/^skype:/i.test(href)) {
    return href.includes("#")
      ? { kind: "dead", reason: "skype link with no handle" }
      : { kind: "ignored" };
  }

  if (/^(mailto|tel):/i.test(href)) {
    const value = href.slice(href.indexOf(":") + 1).trim();
    return value
      ? { kind: "ignored" }
      : { kind: "dead", reason: `empty ${href.split(":")[0]} link` };
  }

  // An in-page jump is only real if something on the page answers to it.
  if (href.startsWith("#")) {
    return link.resolvedAnchor === false
      ? { kind: "dead", reason: "anchor target does not exist on the page" }
      : { kind: "ignored" };
  }

  let resolved: URL;
  try {
    resolved = new URL(href, pageUrl);
  } catch {
    return { kind: "dead", reason: "href cannot be parsed as a URL" };
  }

  if (resolved.origin !== origin) return { kind: "external", href: resolved.href };
  return { kind: "internal", target: resolved.pathname + resolved.search };
}

test("the link crawler recognises every shape of dead link the old site ships", () => {
  const origin = "https://example.test";
  const at = `${origin}/join`;
  const classify = (href: string, resolvedAnchor: boolean | null = null) =>
    classifyLink({ href, text: "link", resolvedAnchor }, at, origin);

  // Dead, all of it.
  expect(classify("#").kind, "a bare # must be reported").toBe("dead");
  expect(classify("").kind).toBe("dead");
  expect(classify("javascript:void(0)").kind).toBe("dead");
  expect(classify("skype:#?chat").kind).toBe("dead");
  expect(classify("mailto:").kind).toBe("dead");
  expect(classify("#no-such-section", false).kind, "an anchor to nothing must be reported").toBe(
    "dead",
  );

  // Perfectly fine, and must not be reported.
  expect(classify("#talent-pool", true).kind).toBe("ignored");
  expect(classify("mailto:hello@deanslist.live").kind).toBe("ignored");
  expect(classify("tel:+13045550100").kind).toBe("ignored");
  expect(classify("https://www.youtube.com/@deanslist").kind).toBe("external");

  // Internal, and therefore fetched and checked for a 404.
  expect(classify("/enter")).toEqual({ kind: "internal", target: "/enter" });
  expect(classify("/watch?show=drop-that-mike")).toEqual({
    kind: "internal",
    target: "/watch?show=drop-that-mike",
  });
  expect(classify(`${origin}/rules`)).toEqual({ kind: "internal", target: "/rules" });
});

test("no page carries a dead link, and every internal href resolves", async ({
  page,
  request,
  baseURL,
}) => {
  test.slow(); // crawls fifteen pages, then fetches every internal URL it found

  const origin = new URL(baseURL!).origin;
  const problems: string[] = [];
  const internal = new Map<string, string>(); // url -> where it was first seen

  for (const route of PUBLIC_ROUTES) {
    const response = await page.goto(route);
    expect(response!.status(), `${route} must load before its links can be crawled`).toBe(200);

    for (const link of await linksOn(page)) {
      const where = `${route} → "${link.text || "(no text)"}" [href="${link.href}"]`;
      const verdict = classifyLink(link, `${origin}${route}`, origin);

      if (verdict.kind === "dead") {
        problems.push(`DEAD LINK (${verdict.reason})  ${where}`);
      } else if (verdict.kind === "internal" && !internal.has(verdict.target)) {
        // Third-party links are recorded but never requested: this suite must
        // not go red because YouTube rate limited a data centre.
        internal.set(verdict.target, where);
      }
    }
  }

  // Guards against a vacuous pass. If the header stopped rendering or the
  // selector broke, the crawl would find nothing and report a clean bill of
  // health, which is the exact failure mode this whole test exists to prevent.
  expect(
    internal.size,
    "the crawl found almost no internal links, which means it is not actually crawling",
  ).toBeGreaterThan(10);

  for (const expected of ["/enter", "/join", "/contact", "/privacy", "/winners"]) {
    expect(
      [...internal.keys()],
      `the crawl never saw a link to ${expected} — either the navigation is broken or the crawl is`,
    ).toContain(expected);
  }

  for (const [target, where] of internal) {
    const res = await request.get(target);
    if (res.status() >= 400) {
      problems.push(`${res.status()} ${target}  (linked from ${where})`);
    }
  }

  expect(
    problems,
    `Dead links found. The old site carries 42 of these; the target is zero.\n` +
      problems.map((p) => `  ${p}`).join("\n"),
  ).toEqual([]);
});

/* ================================================= ids are unique ======== */

/**
 * An element id has to be unique in a document. This is not pedantry about the
 * spec: a `<label for>` resolves to the FIRST element with that id, so the
 * second copy of a duplicated id is unreachable by its own label.
 *
 * That shipped. /join renders LeadForm twice — the talent pool and the crew
 * application — and LeadForm hardcoded `lf-firstName`, `lf-email` and the rest,
 * so clicking the crew form's "First name" label moved focus into the talent
 * pool input a screen and a half further up. LeadForm now derives its ids from
 * useId(); this test is what stops the next component from doing it again, on
 * this page or any other.
 *
 * Orphaned labels are collected in the same pass, because they are the same
 * defect seen from the other end: a `for` that resolves to nothing is a label
 * that does nothing.
 */
type IdAudit = {
  /** ids used more than once, with the tags that used them */
  duplicates: { id: string; tags: string[] }[];
  /** `<label for>` values with no element to point at */
  orphanLabels: { htmlFor: string; text: string }[];
  /** how many distinct ids the audit saw at all */
  total: number;
};

async function auditIds(page: Page): Promise<IdAudit> {
  return page.evaluate(() => {
    const seen = new Map<string, string[]>();

    document.querySelectorAll("[id]").forEach((el) => {
      const id = el.getAttribute("id") ?? "";
      if (!id) return;
      const tags = seen.get(id) ?? [];
      tags.push(el.tagName.toLowerCase());
      seen.set(id, tags);
    });

    const orphanLabels: { htmlFor: string; text: string }[] = [];
    document.querySelectorAll("label[for]").forEach((label) => {
      const target = label.getAttribute("for") ?? "";
      if (!target || !document.getElementById(target)) {
        orphanLabels.push({
          htmlFor: target,
          text: (label.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
        });
      }
    });

    return {
      duplicates: [...seen.entries()]
        .filter(([, tags]) => tags.length > 1)
        .map(([id, tags]) => ({ id, tags })),
      orphanLabels,
      total: seen.size,
    };
  });
}

/**
 * A test for the test. An audit that walks the wrong nodes reports a clean page
 * forever, so it is fed the exact defect /join used to ship — one id on two
 * inputs, with two labels pointing at it — plus a label whose target does not
 * exist, plus perfectly good markup it must leave alone.
 */
test("the id audit really does catch a duplicated id and an orphaned label", async ({
  page,
}) => {
  await page.setContent(`
    <main id="main">
      <form>
        <label for="lf-firstName">First name</label>
        <input id="lf-firstName" name="firstName">
        <label for="lf-email">Email</label>
        <input id="lf-email" name="email">
      </form>
      <form>
        <label for="lf-firstName">First name</label>
        <input id="lf-firstName" name="firstName">
        <label for="lf-nowhere">Nothing answers to this</label>
      </form>
    </main>
  `);

  const audit = await auditIds(page);

  expect(
    audit.duplicates.map((d) => d.id),
    "the audit missed an id used by two inputs on one page",
  ).toEqual(["lf-firstName"]);
  expect(audit.duplicates[0].tags).toEqual(["input", "input"]);

  expect(
    audit.orphanLabels.map((l) => l.htmlFor),
    "the audit missed a label pointing at an id that does not exist",
  ).toEqual(["lf-nowhere"]);

  // And no false positives on the ids that are used exactly once.
  expect(audit.total, "main + two field ids").toBe(3);
});

test("no public page ships a duplicate element id or an orphaned label", async ({ page }) => {
  test.slow(); // loads all fifteen routes

  const problems: string[] = [];
  const idsPerRoute = new Map<string, number>();

  for (const route of PUBLIC_ROUTES) {
    const response = await page.goto(route);
    expect(response!.status(), `${route} must load before its ids can be audited`).toBe(200);

    const audit = await auditIds(page);
    idsPerRoute.set(route, audit.total);

    for (const { id, tags } of audit.duplicates) {
      problems.push(
        `DUPLICATE ID  ${route} → id="${id}" on ${tags.length} elements (${tags.join(", ")}). ` +
          `A label for it can only ever reach the first one.`,
      );
    }
    for (const { htmlFor, text } of audit.orphanLabels) {
      problems.push(`ORPHAN LABEL  ${route} → <label for="${htmlFor}">${text}</label>`);
    }

    // Per page: the audit must have seen something. Every page carries at least
    // the layout's <main id="main">, so zero means the walker is broken and a
    // clean result would be meaningless.
    expect(
      audit.total,
      `the id audit found no ids at all on ${route}, which cannot be right — the layout ` +
        `renders <main id="main"> on every page, so the audit itself is broken`,
    ).toBeGreaterThan(0);
  }

  // And specifically on /join, the page the defect shipped on. Two LeadForms
  // there contribute a labelled id per field; a handful of ids would mean the
  // forms did not render and the duplicate check passed on an empty page.
  expect(
    idsPerRoute.get("/join") ?? 0,
    "/join carries almost no element ids, so its two lead forms did not render and this " +
      "test proved nothing about them",
  ).toBeGreaterThan(8);

  expect(
    problems,
    `Duplicate ids or orphaned labels found. Clicking a label must focus its own field:\n` +
      problems.map((p) => `  ${p}`).join("\n"),
  ).toEqual([]);
});

/* ============================================= no half-rendered numbers == */

/**
 * The single most visible bug on the old homepage: the counter animates from an
 * empty value, so subscribers render as ".7Mil+" and Facebook followers as a
 * bare "K". This walks the text nodes rather than matching a CSS class, so it
 * keeps working when the markup is refactored, and it catches the defect
 * anywhere on the page rather than only inside the stats band.
 */
async function partialNumbersOn(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const offenders: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    // A whole text node that is nothing but an abbreviation suffix: "K", "M+",
    // ".Mil". The number it belonged to never arrived.
    const strandedSuffix = /^[+\-.,\s]*(K|M|B|Mil|Bil)\+?$/i;

    // An abbreviation whose number begins with a separator rather than a digit:
    // ".7Mil+", ".2M". Exactly what the old site prints.
    const headlessNumber = /(^|[^\d])[.,]\d*\s*(K|M|B|Mil|Bil)\b/i;

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const raw = node.textContent ?? "";
      const text = raw.replace(/\s+/g, " ").trim();
      if (!text) continue;

      const owner = node.parentElement;

      // Only rendered copy counts. Next serialises the RSC payload into inline
      // <script> tags, and that payload is full of webpack source maps and
      // coordinate tuples that look like mangled numbers to any regex.
      if (owner?.closest("script, style, template, noscript")) continue;

      // Decorative text is exempt. WinnerPortrait renders a winner's initial in
      // an aria-hidden circle when there is no photograph of them, and a winner
      // called Maria would otherwise look exactly like a stat that lost its
      // digits. A real broken statistic is content, and content is not hidden
      // from screen readers.
      if (owner?.closest('[aria-hidden="true"]')) continue;

      if (strandedSuffix.test(text) || headlessNumber.test(text)) {
        offenders.push(
          `"${text}" in <${owner?.tagName.toLowerCase() ?? "?"} class="${owner?.className ?? ""}">`,
        );
      }
    }
    return offenders;
  });
}

/**
 * A test for the test.
 *
 * "No partial numbers found" is worthless if the detector cannot see one. This
 * feeds it the exact strings the old homepage prints, plus the well-formed
 * figures it must leave alone, so the assertion above can never pass because the
 * scanner quietly stopped working.
 */
test("the partial-number detector really does detect the old site's defect", async ({
  page,
}) => {
  await page.setContent(`
    <section>
      <p class="stat">.7Mil+</p><p>YouTube subscribers</p>
      <p class="stat">K</p><p>Facebook followers</p>
      <p class="stat">$1,000</p><p>Prize awarded</p>
      <p>1.2M views this season</p>
      <p>7,500 entries</p>
      <p>Charleston, WV</p>
      <span aria-hidden="true">M</span>
    </section>
  `);

  const offenders = await partialNumbersOn(page);
  const joined = offenders.join(" | ");

  expect(joined, "the scanner missed '.7Mil+'").toContain(".7Mil+");
  expect(joined, "the scanner missed a bare 'K'").toContain('"K"');

  // And no false positives on figures that are perfectly fine.
  expect(joined).not.toContain("$1,000");
  expect(joined).not.toContain("1.2M");
  expect(joined).not.toContain("7,500");
  expect(joined).not.toContain("Charleston");
  expect(offenders, `unexpected extra findings: ${joined}`).toHaveLength(2);
});

test("the homepage never renders a partial number", async ({ page }) => {
  await page.goto("/");

  const body = await page.locator("body").innerText();
  expect(body, "the old site's broken subscriber counter has reappeared").not.toContain(".7Mil");

  const offenders = await partialNumbersOn(page);
  expect(
    offenders,
    `Half-rendered figures on the homepage:\n${offenders.map((o) => `  ${o}`).join("\n")}\n` +
      `A statistic with no digits in it is worse than no statistic. StatsBand is ` +
      `supposed to render nothing at all when there is no verified figure to show.`,
  ).toEqual([]);
});

test("the sponsors page never renders a partial number either", async ({ page }) => {
  // Same stats band, and the audience for it here is a prospective sponsor, so a
  // broken reach figure is an advertising claim that reads as incompetence.
  await page.goto("/sponsors");

  const offenders = await partialNumbersOn(page);
  expect(offenders, offenders.join("\n")).toEqual([]);
});

/* =============================================== old Joomla URLs move ==== */

/**
 * Confirmed against the old site's own /sitemap.xml — not guessed. Each entry is
 * `[requested path, where it must land]`. The wildcards at the end are the
 * catch-alls in next.config.ts, exercised with a path that matches nothing
 * specific, which is the case that actually happens after cutover.
 */
const JOOMLA_REDIRECTS: [string, string][] = [
  ["/index.php", "/"],
  ["/index.php/what-is-the-deans-list", "/about"],
  ["/index.php/join-the-dean-team", "/join"],
  ["/index.php/upcoming-events/deans-list-drop-that-mike-challenge", "/shows/drop-that-mike"],
  ["/index.php/past-challenges/1st-crown-the-sound-winner", "/winners/pj-galloway"],
  ["/index.php/videos", "/watch"],
  ["/index.php/upcoming-events/some-retired-event", "/shows"],
  ["/index.php/past-challenges/some-retired-challenge", "/winners"],
  ["/index.php/an-article-nobody-remembers", "/"],
];

/**
 * The `source` patterns this suite claims to cover, in the order next.config.ts
 * declares them. Compared against the config itself below, so adding a redirect
 * without testing it fails the build rather than shipping untested.
 */
/**
 * Next's own Redirect type is a union of `{ permanent }` and `{ statusCode }`,
 * which is awkward to narrow; this reads both shapes without fighting it.
 */
type RedirectRule = {
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
};

type ConfigLike = { redirects?: () => Promise<RedirectRule[]> };

/**
 * Playwright transpiles TypeScript to CommonJS, so `await import()` of a TS
 * module with a default export arrives double-wrapped as `{ default: { default:
 * config } }`. Unwrap until the object actually looks like the config, so this
 * keeps working if the runner ever loads ESM natively instead.
 */
function unwrapDefault(mod: unknown): ConfigLike {
  let current: unknown = mod;
  for (let depth = 0; depth < 4; depth++) {
    if (current && typeof current === "object" && "redirects" in current) {
      return current as ConfigLike;
    }
    if (current && typeof current === "object" && "default" in current) {
      current = (current as { default: unknown }).default;
      continue;
    }
    break;
  }
  return (current ?? {}) as ConfigLike;
}

const COVERED_SOURCES = [
  "/index.php",
  "/index.php/what-is-the-deans-list",
  "/index.php/join-the-dean-team",
  "/index.php/upcoming-events/deans-list-drop-that-mike-challenge",
  "/index.php/past-challenges/1st-crown-the-sound-winner",
  "/index.php/videos",
  "/index.php/upcoming-events/:path*",
  "/index.php/past-challenges/:path*",
  "/index.php/:path*",
];

test.describe("old Joomla URLs", () => {
  for (const [from, to] of JOOMLA_REDIRECTS) {
    test(`${from} permanently redirects to ${to}`, async ({ request, baseURL }) => {
      const res = await request.get(from, { maxRedirects: 0 });

      expect(
        [301, 308],
        `${from} answered ${res.status()}. A temporary redirect does not pass ranking on, ` +
          `and a 200 or 404 loses it entirely.`,
      ).toContain(res.status());

      const location = res.headers()["location"];
      expect(location, `${from} redirected without a Location header`).toBeTruthy();

      const landed = new URL(location, baseURL!).pathname;
      expect(landed, `${from} went to the wrong place`).toBe(to);

      // A redirect to a 404 is not a working redirect.
      const destination = await request.get(to);
      expect(
        destination.status(),
        `${from} redirects to ${to}, which itself does not return 200`,
      ).toBe(200);
    });
  }

  test("every redirect declared in next.config.ts is covered above", async () => {
    // The config is imported so that IT is the source of truth for which
    // redirects exist, while the table above stays the source of truth for where
    // each one has to land. Add a redirect without testing it and this fails.
    const nextConfig = unwrapDefault(await import("../next.config"));

    expect(typeof nextConfig.redirects, "next.config.ts no longer defines redirects()").toBe(
      "function",
    );

    const rules = await nextConfig.redirects!();

    expect(
      rules.map((r) => r.source),
      "next.config.ts declares a redirect this suite does not check, or has dropped one it does",
    ).toEqual(COVERED_SOURCES);

    for (const rule of rules) {
      expect(
        rule.permanent === true || rule.statusCode === 301,
        `${rule.source} is not a permanent redirect — the old page's ranking will not transfer`,
      ).toBe(true);
    }
  });
});
