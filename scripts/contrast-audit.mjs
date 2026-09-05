/**
 * Walk the dashboard in a real browser and measure what is actually painted.
 *
 * This exists because "is it readable" cannot be answered by reading source. A
 * class can be correct and still land on a ground three ancestors up that
 * nobody looked at; a token can be right in the config and wrong once an
 * opacity between it and the page has multiplied it; and a `hover:` variant can
 * quietly beat the plain class it sits beside. The only honest measurement is
 * the computed one, so this reads getComputedStyle on the rendered page and
 * walks up the ancestor chain compositing every semi-transparent layer until it
 * hits something opaque.
 *
 * It checks four things, because an earlier version checked only the first and
 * a review found a whole class of defect it was blind to:
 *
 *   TEXT         4.5:1, or 3:1 at >=24px / >=18.66px bold        (WCAG 1.4.3)
 *   PLACEHOLDER  4.5:1. Measured separately, because ::placeholder is not a
 *                text node and never appears in the DOM walk
 *   BOUNDARY     3:1 for a border that IS the edge of a control or panel. On a
 *                dark theme a panel fill is rarely more than 1.1:1 against the
 *                page, so the border does all the work and cannot be
 *                decorative                                     (WCAG 1.4.11)
 *   FOCUS        reports the ring so a weak one cannot pass unnoticed (1.4.11)
 *
 * Detail routes are discovered rather than hardcoded: the suite follows the
 * first row link on each index page, because /admin/leads/[id] and friends hold
 * a large share of the dashboard and no fixed id survives a reseed.
 *
 *   node scripts/contrast-audit.mjs
 *   BASE_URL=https://... node scripts/contrast-audit.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL || "admin@deanslist.live";
const PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe123!";

/** Index routes, plus the "new" forms, which no index links to as a row. */
const INDEX = [
  "/admin",
  "/admin/leads",
  "/admin/shows",
  "/admin/shows/new",
  "/admin/winners",
  "/admin/winners/new",
  "/admin/gallery",
  "/admin/content",
  "/admin/content/sections",
  "/admin/content/sponsors",
  "/admin/content/stats",
  "/admin/segments",
  "/admin/campaigns",
  "/admin/campaigns/new",
  "/admin/chatbot",
  "/admin/chatbot/knowledge",
  "/admin/team",
];

/** One detail route per collection, found by following the first row link. */
const DETAIL_FROM = [
  "/admin/leads",
  "/admin/shows",
  "/admin/winners",
  "/admin/campaigns",
  "/admin/chatbot",
];

const AUDIT = () => {
  const parse = (c) => {
    if (!c || c === "transparent") return null;
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };

  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  /** Composite every layer from `from` upward until something is opaque. */
  const groundAbove = (from) => {
    const stack = [];
    for (let n = from; n && n !== document.documentElement; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        stack.push(c);
        if (c.a === 1) break;
      }
    }
    const html = parse(getComputedStyle(document.documentElement).backgroundColor);
    let base = html && html.a === 1 ? html : { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  };

  const rgb = (c) => "rgb(" + [c.r, c.g, c.b].map(Math.round).join(",") + ")";

  const where = (el) => {
    const path = [];
    for (let n = el; n && n.tagName !== "BODY" && path.length < 3; n = n.parentElement) {
      const cls =
        typeof n.className === "string"
          ? n.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      path.unshift(n.tagName.toLowerCase() + (cls ? "." + cls : ""));
    }
    return path.join(" > ");
  };

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return null;
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return null;
    return cs;
  };

  const out = [];
  const seen = new Set();
  const push = (kind, el, got, need, detail) => {
    const key = kind + "|" + el.tagName + "|" + detail.slice(0, 50);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, ratio: Math.round(got * 100) / 100, need, detail, where: where(el) });
  };

  /* ------------------------------------------------------------- TEXT */
  for (const el of document.querySelectorAll("body *")) {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim())
      .join(" ");
    if (!own) continue;
    const cs = visible(el);
    if (!cs) continue;

    const raw = parse(cs.color);
    if (!raw) continue;
    const outside = groundAbove(el.parentElement || el);
    const ownBg = parse(cs.backgroundColor);
    const ground = ownBg && ownBg.a > 0 ? over(ownBg, outside) : outside;
    const fg = raw.a < 1 ? over(raw, ground) : raw;

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const r = ratio(fg, ground);
    if (r < need) {
      push(
        "TEXT",
        el,
        r,
        need,
        size + "px/" + weight + " " + cs.color + " on " + rgb(ground) + ' "' + own.slice(0, 46) + '"',
      );
    }
  }

  /* ------------------------------------------------------ PLACEHOLDER */
  for (const el of document.querySelectorAll("input[placeholder], textarea[placeholder]")) {
    const cs = visible(el);
    if (!cs) continue;
    const raw = parse(getComputedStyle(el, "::placeholder").color);
    if (!raw) continue;
    const ground = groundAbove(el);
    const fg = raw.a < 1 ? over(raw, ground) : raw;
    const r = ratio(fg, ground);
    if (r < 4.5) {
      push(
        "PLACEHOLDER",
        el,
        r,
        4.5,
        rgb(fg) + " on " + rgb(ground) + ' "' + el.getAttribute("placeholder").slice(0, 40) + '"',
      );
    }
  }

  /* --------------------------------------------------------- BOUNDARY */
  /* A control or panel whose FILL is within 1.2:1 of what surrounds it is
     identified by its border, so that border has to clear 3:1. One with a
     distinct fill is exempt: it is already identifiable without an edge. */
  /* .notice-strong is composed with @apply, so an element carrying it does
     NOT also carry .notice and has to be listed by name. */
  const BOUNDED =
    "input, select, textarea, button, .card, .notice, .notice-strong, table, fieldset";
  for (const el of document.querySelectorAll(BOUNDED)) {
    const cs = visible(el);
    if (!cs) continue;

    /* Three things this check must NOT report, or it becomes noise nobody
       reads, which is worse than not having it.

       A text button. No fill and no visible border, identified by its label:
       1.4.11 asks for an edge only where the edge is what identifies the
       control. `.btn-ghost` declares border-2 with a transparent colour, so
       "no border" here means zero width OR zero alpha, not just zero width.

       A native checkbox or radio, which the browser draws itself once
       color-scheme is declared.

       A table whose WRAPPER carries the border. The wrapper is what the eye
       reads as the table's edge; measuring the <table> element alone reports a
       boundary failure for a table that visibly has one. */
    const bc0 = parse(cs.borderTopColor);
    const noEdge = parseFloat(cs.borderTopWidth) === 0 || !bc0 || bc0.a === 0;
    const noFill = cs.backgroundColor === "rgba(0, 0, 0, 0)";
    if (noEdge && noFill && el.tagName === "BUTTON" && el.textContent.trim()) continue;
    if (/^(checkbox|radio)$/.test(el.getAttribute("type") || "") && cs.appearance !== "none") continue;
    if (noEdge && el.tagName === "FIELDSET") continue;
    if (el.tagName === "TABLE" && noEdge) {
      const wrap = el.parentElement;
      const wc = wrap && parse(getComputedStyle(wrap).borderTopColor);
      if (wc && wc.a > 0 && parseFloat(getComputedStyle(wrap).borderTopWidth) > 0) continue;
    }

    const outside = groundAbove(el.parentElement || el);
    const ownBg = parse(cs.backgroundColor);
    const fill = ownBg && ownBg.a > 0 ? over(ownBg, outside) : outside;
    const fillRatio = ratio(fill, outside);
    if (fillRatio >= 1.2) continue;

    const bw = parseFloat(cs.borderTopWidth) || 0;
    const bc = parse(cs.borderTopColor);
    if (bw === 0 || !bc || bc.a === 0) {
      push(
        "BOUNDARY",
        el,
        1,
        3,
        "no border, and its fill is only " + Math.round(fillRatio * 100) / 100 + ":1 against the surround",
      );
      continue;
    }
    const edge = bc.a < 1 ? over(bc, outside) : bc;
    const r = ratio(edge, outside);
    if (r < 3) {
      push(
        "BOUNDARY",
        el,
        r,
        3,
        "border " + cs.borderTopColor + " on " + rgb(outside) +
          ", fill only " + Math.round(fillRatio * 100) / 100 + ":1",
      );
    }
  }

  return out;
};

/** The focus ring, read off a really focused element rather than in the abstract. */
const FOCUS = () => {
  const el = document.querySelector(".admin a[href], .admin button, .admin input");
  if (!el) return null;
  el.focus();
  const cs = getComputedStyle(el);
  return { color: cs.outlineColor, width: cs.outlineWidth, style: cs.outlineStyle };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

console.log("Auditing " + BASE + "\n");

const byKind = { TEXT: 0, PLACEHOLDER: 0, BOUNDARY: 0 };
let total = 0;

const report = (route, findings) => {
  if (!findings.length) {
    console.log(route + "  clean");
    return;
  }
  console.log(route + "  " + findings.length + " finding" + (findings.length === 1 ? "" : "s"));
  for (const f of findings.slice(0, 10)) {
    byKind[f.kind] = (byKind[f.kind] || 0) + 1;
    console.log("   " + f.kind.padEnd(11) + String(f.ratio).padStart(5) + ":1 (needs " + f.need + ")  " + f.detail);
    console.log("               " + f.where);
  }
  if (findings.length > 10) console.log("   and " + (findings.length - 10) + " more");
  total += findings.length;
};

/* The login page is measured BEFORE signing in: it is the one admin screen a
   signed-out person sees, and the previous suite only ever typed into it. */
await page.goto(BASE + "/admin/login", { waitUntil: "networkidle", timeout: 120000 });
report("/admin/login", await page.evaluate(AUDIT));

await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click("button[type=submit]");
await page.waitForURL("**/admin", { timeout: 60000 }).catch(() => {});

/* Discover one detail route per collection. */
const detail = [];
for (const index of DETAIL_FROM) {
  await page.goto(BASE + index, { waitUntil: "networkidle", timeout: 120000 }).catch(() => {});
  const href = await page
    .evaluate((prefix) => {
      /* A row link ends in a record id, not a word: /admin/chatbot also
         contains a nav link to /admin/chatbot/knowledge, and following that
         audits an index page twice while auditing no transcript at all. */
      const a = [...document.querySelectorAll('a[href^="' + prefix + '/"]')]
        .map((x) => x.getAttribute("href"))
        .find((h) => {
          if (!h || h.includes("?")) return false;
          const last = h.slice(prefix.length + 1);
          return /^[a-z0-9]{12,}$/i.test(last);
        });
      return a || null;
    }, index)
    .catch(() => null);
  if (href) detail.push(href);
}
console.log("\nDiscovered " + detail.length + " detail routes: " + (detail.join(", ") || "none") + "\n");

const routes = [...new Set([...INDEX, ...detail])];
for (const route of routes) {
  const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 120000 }).catch(() => null);
  if (!res || res.status() >= 400) {
    console.log(route + "  " + (res ? res.status() : "no response"));
    continue;
  }
  await page.waitForTimeout(800);
  report(route, await page.evaluate(AUDIT));
}

const focus = await page.evaluate(FOCUS);
console.log("\nFocus ring: " + (focus ? focus.width + " " + focus.style + " " + focus.color : "no focusable element found"));
console.log(
  total + " findings across " + (routes.length + 1) + " routes " +
    "(text " + (byKind.TEXT || 0) + ", placeholder " + (byKind.PLACEHOLDER || 0) +
    ", boundary " + (byKind.BOUNDARY || 0) + ").",
);

await browser.close();
process.exit(total > 0 ? 1 : 0);
