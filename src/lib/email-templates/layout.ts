/**
 * The shell every campaign email is built inside, plus the small set of block
 * helpers the five templates compose from.
 *
 * Why this is written by hand rather than with a component library:
 *
 *   Gmail strips <style> blocks in several of its clients, Outlook 2016-2019
 *   renders through Word (no flexbox, no grid, no max-width, no border-radius on
 *   a plain div), and Yahoo rewrites class names. Everything below is therefore
 *   a nested <table> with inline styles only. No <style> block exists in the
 *   output at all, so nothing can be stripped out from under it.
 *
 * The design tokens cannot come from Tailwind — an email client never sees the
 * stylesheet — so the palette is mirrored here as literals. These are the exact
 * values from tailwind.config.ts, not new ones. The `chalk` text ramp is defined
 * there as rgba() over the page background; email needs opaque hex, so the same
 * three steps are flattened against the #16161C panel below.
 */

import { SITE } from "@/content/site";
import { env } from "@/lib/env";

/* ---------------------------------------------------------------- palette */

export const PALETTE = {
  /** ink.DEFAULT — the page behind the card */
  ink: "#0A0A0C",
  /** ink.raised — footer band */
  inkRaised: "#101015",
  /** ink.soft — the card itself */
  inkSoft: "#16161C",
  /** ink.high — nested panel inside the card */
  inkHigh: "#1E1E26",
  /** ink.line — hairline */
  line: "#2A2A34",
  /** ink.edge — emphasised border */
  edge: "#3A3A46",

  /** chalk.DEFAULT — display type only */
  white: "#FFFFFF",
  /** chalk.body, rgba(255,255,255,0.72) flattened over #16161C */
  body: "#BEBEBF",
  /** chalk.muted, rgba(255,255,255,0.50) flattened over #16161C */
  muted: "#8A8A8E",
  /** chalk.faint, rgba(255,255,255,0.34) flattened over #16161C */
  faint: "#656569",

  /** gold.DEFAULT — accent only, never a large fill */
  gold: "#D4AF37",
  goldSoft: "#E8CC72",
  goldDeep: "#A88423",

  /** brandred.live — urgency only: deadlines and live badges */
  red: "#FF2D42",
} as const;

/**
 * Bebas Neue is a webfont; an email client will not load it and Outlook would
 * fall back to Times. Headings use the same uppercase + tracking treatment in a
 * face that is installed everywhere, which reads as the same design language.
 */
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const CONTENT_WIDTH = 600;

/* ------------------------------------------------------------- primitives */

/** Escape anything that came from a database row or a campaign author. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * A link in an email is still an injection surface: `javascript:` and `data:`
 * hrefs are filtered by most clients but not all, and a token value can come
 * from a campaign author or an imported row. Anything that is not plain http,
 * https or mailto is replaced with the fallback rather than rendered.
 */
export function safeUrl(value: string | null | undefined, fallback = ""): string {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

/** Absolute URL on the public site. Emails cannot use relative paths. */
export function siteUrl(path = "/"): string {
  return new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();
}

/* ----------------------------------------------------------------- blocks */

/** Small uppercase gold label. The `.eyebrow` token, inlined. */
export function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${PALETTE.gold};">${escapeHtml(text)}</p>`;
}

/** The one big statement per email. White, uppercase, tight leading. */
export function heading(text: string): string {
  return `<h1 style="margin:0 0 18px;font-family:${FONT};font-size:30px;line-height:1.12;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${PALETTE.white};">${escapeHtml(text)}</h1>`;
}

export function subheading(text: string): string {
  return `<h2 style="margin:0 0 12px;font-family:${FONT};font-size:18px;line-height:1.25;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${PALETTE.white};">${escapeHtml(text)}</h2>`;
}

/** Body copy. `html` is trusted markup assembled by a template, not raw input. */
export function paragraph(html: string, opts: { muted?: boolean } = {}): string {
  const color = opts.muted ? PALETTE.muted : PALETTE.body;
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.65;color:${color};">${html}</p>`;
}

/** Inline emphasis inside a paragraph. Gold is the accent, never the body text. */
export function accent(text: string): string {
  return `<strong style="color:${PALETTE.gold};font-weight:700;">${escapeHtml(text)}</strong>`;
}

/** Red is reserved for urgency: deadlines, final hours, live. Nothing else. */
export function urgent(text: string): string {
  return `<strong style="color:${PALETTE.red};font-weight:700;">${escapeHtml(text)}</strong>`;
}

/**
 * Primary call to action.
 *
 * A padded table cell, not an <a> with padding — Outlook collapses padding on an
 * inline element. Outlook also ignores border-radius, so the pill renders as a
 * gold rectangle there. That is deliberate: the alternative is a block of VML
 * per button, which doubles the size of every template to round four corners in
 * one client.
 */
export function button(href: string, label: string): string {
  const url = escapeHtml(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;"><tr>
      <td align="center" bgcolor="${PALETTE.gold}" style="border-radius:999px;background-color:${PALETTE.gold};">
        <a href="${url}" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${PALETTE.ink};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
      </td>
    </tr></table>`;
}

/** Secondary action. A plain link, never competing with the gold button. */
export function secondaryLink(href: string, label: string): string {
  return `<p style="margin:4px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;"><a href="${escapeHtml(href)}" style="color:${PALETTE.goldSoft};text-decoration:underline;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

/** Raised box for a details block: `.card` one elevation step up. */
export function panel(innerHtml: string, opts: { accentBorder?: boolean } = {}): string {
  const border = opts.accentBorder ? PALETTE.goldDeep : PALETTE.line;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;background-color:${PALETTE.inkHigh};border:1px solid ${border};border-radius:10px;"><tr>
      <td style="padding:22px 24px;">${innerHtml}</td>
    </tr></table>`;
}

/**
 * One labelled fact. Two stacked lines rather than two columns, because a
 * two-column row at 320px in Gmail on Android wraps into a mess.
 */
export function fact(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:0 0 14px;">
        <span style="display:block;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${PALETTE.faint};">${escapeHtml(label)}</span>
        <span style="display:block;padding-top:4px;font-family:${FONT};font-size:17px;font-weight:700;color:${PALETTE.white};">${escapeHtml(value)}</span>
      </td>
    </tr></table>`;
}

/** Numbered step, used by the how-it-works block. */
export function step(index: number, title: string, body: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="34" valign="top" style="width:34px;font-family:${FONT};font-size:16px;font-weight:700;color:${PALETTE.gold};padding:0 0 14px;">${index}.</td>
      <td valign="top" style="padding:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.55;color:${PALETTE.body};"><strong style="color:${PALETTE.white};">${escapeHtml(title)}</strong> &mdash; ${escapeHtml(body)}</td>
    </tr></table>`;
}

export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:8px 0 24px;"><div style="height:1px;line-height:1px;font-size:0;background-color:${PALETTE.line};">&nbsp;</div></td>
    </tr></table>`;
}

export function spacer(px = 16): string {
  return `<div style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</div>`;
}

/* ------------------------------------------------------------------ types */

/**
 * The five templates the signed scope promises. These strings are also what
 * `Campaign.templateKey` stores, so the enum lives here and the schema comment
 * matches it exactly.
 */
export const TEMPLATE_KEYS = ["announcement", "reminder", "deadline", "results", "winner"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/**
 * Token values after resolution: every string is final and safe to interpolate,
 * and every field that could legitimately be unknown is `null` rather than a
 * guess. Templates branch on the nulls — an email must never print
 * "Show date: {{showDate}}" and must never invent a date to avoid it.
 */
export type TemplateContext = {
  firstName: string;
  showTitle: string;
  /**
   * When the show itself starts — `Show.startsAt`. null when the client has not
   * confirmed a date. See PROJECT-BRIEF §8.
   */
  showDate: string | null;
  /**
   * When entries close — `Show.entryDeadline`. A separate column in the schema
   * and a separate slot here, because they are separate moments: entries for a
   * video-entry show close days before the broadcast. Reusing `showDate` for
   * this told entrants the wrong closing time on a competition with a cash
   * prize, which is a promise the client then has to keep.
   *
   * null when no deadline is confirmed, and it never falls back to `showDate` —
   * a template says "closing soon" instead. An invented deadline is worse than
   * a vague one.
   */
  deadlineDate: string | null;
  /** Formatted, e.g. "$1,000". null when the prize pool is unconfirmed. */
  prizeAmount: string | null;
  entryLink: string;
  unsubscribeLink: string;
  /** Optional extras. null when unknown; every template degrades without them. */
  winnerName: string | null;
  showLink: string;
  watchLink: string;
};

export type EmailTemplate = {
  key: TemplateKey;
  /** Shown in the template picker in the campaign composer. */
  name: string;
  description: string;
  /** Default subject line. May contain {{tokens}}; the composer can override. */
  subject: string;
  /** Default inbox preview text. May contain {{tokens}}. */
  preheader: string;
  /** Inner body HTML — the shell is added by render(). */
  html: (ctx: TemplateContext) => string;
  /** Plain-text body lines — the shell is added by render(). */
  text: (ctx: TemplateContext) => string[];
};

/* ------------------------------------------------------------------ shell */

export type LayoutInput = {
  /** Sets <title>. Some clients show it; screen readers announce it. */
  title: string;
  preheader: string;
  bodyHtml: string;
  /** Validated upstream by render(). Never optional — see index.ts. */
  unsubscribeLink: string;
};

/**
 * Gmail shows the first text it finds after the subject. Without this hidden
 * block that is the eyebrow, so every email would preview as "THE DEAN'S LIST".
 * The zero-width padding after it stops real body copy being pulled in behind
 * the intended preview text.
 */
function preheaderBlock(text: string): string {
  const padding = "&#847;&zwnj;&nbsp;".repeat(30);
  return `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${PALETTE.ink};">${escapeHtml(text)}${padding}</div>`;
}

export function renderLayout({ title, preheader, bodyHtml, unsubscribeLink }: LayoutInput): string {
  const home = escapeHtml(siteUrl("/"));
  const privacy = escapeHtml(siteUrl("/privacy"));
  const unsub = escapeHtml(unsubscribeLink);

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background-color:${PALETTE.ink};">
${preheaderBlock(preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PALETTE.ink};">
  <tr>
    <td align="center" style="padding:28px 12px 40px;">
      <!--[if mso | IE]><table role="presentation" width="${CONTENT_WIDTH}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${CONTENT_WIDTH}px;margin:0 auto;">

        <tr>
          <td align="center" style="padding:0 0 20px;">
            <a href="${home}" style="font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:${PALETTE.white};text-decoration:none;">THE DEAN&#39;S LIST</a>
          </td>
        </tr>

        <tr>
          <td style="background-color:${PALETTE.inkSoft};border:1px solid ${PALETTE.line};border-radius:14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="height:3px;line-height:3px;font-size:0;background-color:${PALETTE.gold};border-radius:14px 14px 0 0;">&nbsp;</td></tr>
              <tr><td style="padding:34px 30px 30px;">${bodyHtml}</td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 24px 0;">
            <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:1.6;color:${PALETTE.faint};">
              You are receiving this because you asked for show announcements from ${escapeHtml(SITE.name)}.
            </p>
            <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:1.6;color:${PALETTE.faint};">
              <a href="${unsub}" style="color:${PALETTE.muted};text-decoration:underline;">Unsubscribe</a>
              &nbsp;&middot;&nbsp;
              <a href="${privacy}" style="color:${PALETTE.muted};text-decoration:underline;">Privacy policy</a>
            </p>
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${PALETTE.faint};">
              ${escapeHtml(SITE.legalName)}, ${escapeHtml(SITE.location)}, USA
            </p>
          </td>
        </tr>

      </table>
      <!--[if mso | IE]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Plain-text alternative. Not decoration: a message with no text part scores
 * worse with every spam filter, and some corporate clients render text only.
 */
export function renderTextLayout({
  title,
  lines,
  unsubscribeLink,
}: {
  title: string;
  lines: string[];
  unsubscribeLink: string;
}): string {
  return [
    SITE.name.toUpperCase(),
    "",
    title.toUpperCase(),
    "=".repeat(Math.min(Math.max(title.length, 8), 60)),
    "",
    lines.join("\n"),
    "",
    "---",
    `You are receiving this because you asked for show announcements from ${SITE.name}.`,
    `Unsubscribe: ${unsubscribeLink}`,
    `${SITE.legalName}, ${SITE.location}, USA`,
    "",
  ].join("\n");
}
