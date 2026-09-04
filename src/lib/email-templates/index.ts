/**
 * Branded email template library.
 *
 * Public surface:
 *   render()          build one email, ready to hand to @/lib/mail
 *   renderPreview()   the same thing with sample data, for the composer
 *   TEMPLATES         the registry, keyed by Campaign.templateKey
 *   TEMPLATE_LIST     the same thing shaped for a picker
 *
 * Two guarantees this module makes, both enforced here rather than left to the
 * caller to remember:
 *
 *   1. No email can be rendered without an unsubscribe link. render() throws.
 *      A campaign system that can produce an email with no way out is a legal
 *      problem, not a missing feature, so it is impossible by construction.
 *
 *   2. No {{token}} survives into the output. Every known token is substituted
 *      with a value or a sensible fallback, unknown ones are removed, and the
 *      assembled HTML and text are swept once more before returning. Shipping a
 *      literal "Hi {{firstName}}" to 700K people is the kind of mistake that is
 *      only ever made once.
 */

import {
  TEMPLATE_KEYS,
  renderLayout,
  renderTextLayout,
  safeUrl,
  siteUrl,
  type EmailTemplate,
  type TemplateContext,
  type TemplateKey,
} from "./layout";
import { announcement } from "./announcement";
import { reminder } from "./reminder";
import { deadline } from "./deadline";
import { results } from "./results";
import { winner } from "./winner";
import { SITE } from "@/content/site";

export { TEMPLATE_KEYS, type TemplateKey, type TemplateContext, type EmailTemplate };
export { PALETTE } from "./layout";

/* --------------------------------------------------------------- registry */

export const TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  announcement,
  reminder,
  deadline,
  results,
  winner,
};

/** Shape the campaign composer's template picker reads. */
export const TEMPLATE_LIST = TEMPLATE_KEYS.map((key) => ({
  key,
  name: TEMPLATES[key].name,
  description: TEMPLATES[key].description,
  subject: TEMPLATES[key].subject,
}));

/** Narrowing guard for a value out of the database or a form. */
export function isTemplateKey(value: unknown): value is TemplateKey {
  return typeof value === "string" && (TEMPLATE_KEYS as readonly string[]).includes(value);
}

/* ----------------------------------------------------------------- tokens */

/**
 * What a caller supplies. Everything except `unsubscribeLink` is optional: an
 * absent value falls back rather than failing, because a reminder that goes out
 * without a prize figure is fine and one that does not go out at all is not.
 *
 * The six tokens in the signed scope are firstName, showTitle, showDate,
 * prizeAmount, entryLink and unsubscribeLink. deadlineDate, winnerName, showLink
 * and watchLink are additions the deadline, results and spotlight templates
 * need; they follow the same fallback rules.
 */
export type TokenValues = {
  firstName?: string | null;
  showTitle?: string | null;
  /**
   * When the show starts — `Show.startsAt`. A Date is formatted in UTC with the
   * zone shown. Pass a string to control it.
   */
  showDate?: string | Date | null;
  /**
   * When entries close — `Show.entryDeadline`. Same formatting rules as
   * `showDate`, and deliberately a separate value: the deadline template is
   * about this moment, not about the broadcast, and the two are days apart on a
   * video-entry show.
   *
   * Optional. Omitted means "no confirmed deadline", not "same as showDate" —
   * see resolveContext.
   */
  deadlineDate?: string | Date | null;
  /** A number is formatted as USD. Pass a string for anything else. */
  prizeAmount?: string | number | null;
  entryLink?: string | null;
  /** Required. Mint it with unsubscribeUrlFor() from @/lib/unsubscribe. */
  unsubscribeLink: string;
  winnerName?: string | null;
  showLink?: string | null;
  watchLink?: string | null;
};

/** "there" is the fallback greeting. Never "Hi ," and never "Hi {{firstName}},". */
const FALLBACK_FIRST_NAME = "there";

const prizeFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * UTC with the zone named. This audience is global — the old site's own copy
 * calls it a global competition — so a bare "8:00 PM" is wrong for almost
 * everyone reading it. Callers who know the broadcast timezone should pass a
 * preformatted string instead.
 */
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

function text(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Shared by showDate and deadlineDate — both are "a moment, or nothing". */
function formatDate(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : dateFormatter.format(value);
  }
  return text(value);
}

function formatPrize(value: string | number | null | undefined): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? prizeFormatter.format(value) : null;
  }
  return text(value);
}

/**
 * Turn caller input into the fully resolved context the templates render from.
 * Anything genuinely unknown stays null so a template can choose its own words
 * for the gap — that is how "Date: to be announced" happens instead of a guess.
 *
 * `deadlineDate` does not fall back to `showDate`. They are different moments —
 * entries close, then the show starts — and a caller that has not supplied a
 * deadline has not confirmed one. Borrowing the broadcast date would print a
 * closing time that is not the closing time, which on a cash-prize competition
 * is a fact the client is then held to.
 */
function resolveContext(tokens: TokenValues): TemplateContext {
  const unsubscribeLink = safeUrl(tokens.unsubscribeLink);

  if (!text(tokens.unsubscribeLink)) {
    throw new Error(
      "[email-templates] unsubscribeLink is required. Mint one with unsubscribeUrlFor(leadId) " +
        "from @/lib/unsubscribe — an email that cannot be unsubscribed from must never be sent.",
    );
  }
  if (!unsubscribeLink) {
    throw new Error(
      `[email-templates] unsubscribeLink is not a usable http(s) URL: ${String(tokens.unsubscribeLink)}`,
    );
  }

  const home = siteUrl("/");

  return {
    firstName: text(tokens.firstName) ?? FALLBACK_FIRST_NAME,
    showTitle: text(tokens.showTitle) ?? SITE.name,
    showDate: formatDate(tokens.showDate),
    deadlineDate: formatDate(tokens.deadlineDate),
    prizeAmount: formatPrize(tokens.prizeAmount),
    entryLink: safeUrl(tokens.entryLink, siteUrl("/enter")),
    unsubscribeLink,
    winnerName: text(tokens.winnerName),
    showLink: safeUrl(tokens.showLink, siteUrl("/shows")),
    watchLink: safeUrl(tokens.watchLink, siteUrl("/watch")),
  };
}

/**
 * Substitution map for author-written strings — subject lines, preheaders, and
 * any body the composer supplies. Nulls resolve to a phrase that still reads as
 * a sentence, because a subject line cannot branch on a missing value the way a
 * template body can.
 */
function tokenMap(ctx: TemplateContext): Record<string, string> {
  return {
    firstName: ctx.firstName,
    showTitle: ctx.showTitle,
    showDate: ctx.showDate ?? "soon",
    deadlineDate: ctx.deadlineDate ?? "soon",
    prizeAmount: ctx.prizeAmount ?? "the prize",
    entryLink: ctx.entryLink,
    unsubscribeLink: ctx.unsubscribeLink,
    winnerName: ctx.winnerName ?? "the winner",
    showLink: ctx.showLink,
    watchLink: ctx.watchLink,
    siteName: SITE.name,
    siteUrl: siteUrl("/"),
  };
}

/** Matches {{ anything without braces }}. */
const TOKEN_PATTERN = /\{\{([^{}]*)\}\}/g;

export function applyTokens(input: string, map: Record<string, string>): string {
  return input.replace(TOKEN_PATTERN, (_match, rawName: string) => {
    const name = rawName.trim();
    const value = map[name];
    if (value === undefined) {
      // An unknown token is an author typo. Removing it is the only safe
      // outcome — leaving it visible is worse than a missing word.
      console.warn(`[email-templates] unknown token {{${name}}} removed from output`);
      return "";
    }
    return value;
  });
}

/**
 * Last line of defence. Nothing this module writes contains braces, so anything
 * caught here came from a caller-supplied string that applyTokens could not
 * parse — an unclosed {{ , or a value that itself contained a token.
 */
function sweep(output: string, label: string): string {
  if (!output.includes("{{")) return output;
  const swept = applyTokens(output, {});
  if (swept.includes("{{")) {
    console.warn(`[email-templates] malformed token markup left in ${label}; removing "{{"`);
    return swept.split("{{").join("");
  }
  return swept;
}

/* ----------------------------------------------------------------- render */

export type RenderInput = {
  template: TemplateKey;
  tokens: TokenValues;
  /** Overrides the template's default subject. May contain {{tokens}}. */
  subject?: string | null;
  /** Overrides the default inbox preview text. May contain {{tokens}}. */
  preheader?: string | null;
  /**
   * Replaces the template body with composer-authored HTML, still inside the
   * branded shell. Trusted admin markup only — this is not sanitised, so it must
   * never be fed anything an unauthenticated visitor supplied.
   */
  bodyHtml?: string | null;
  /** Plain-text alternative for a custom body. Derived from bodyHtml if absent. */
  bodyText?: string | null;
};

export type RenderedEmail = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

/** Crude tag strip, only used when a custom HTML body arrives without a text one. */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function render(input: RenderInput): RenderedEmail {
  const template = TEMPLATES[input.template];
  if (!template) {
    throw new Error(`[email-templates] unknown template "${String(input.template)}"`);
  }

  const ctx = resolveContext(input.tokens);
  const map = tokenMap(ctx);

  const subject = sweep(applyTokens(text(input.subject) ?? template.subject, map), "subject").trim();
  const preheader = sweep(
    applyTokens(text(input.preheader) ?? template.preheader, map),
    "preheader",
  ).trim();

  const customBody = text(input.bodyHtml);
  const customText = text(input.bodyText);
  const bodyHtml = customBody ? applyTokens(customBody, map) : template.html(ctx);
  const bodyLines = customBody
    ? (customText ? applyTokens(customText, map) : htmlToText(bodyHtml)).split("\n")
    : template.text(ctx);

  const html = sweep(
    renderLayout({
      title: subject,
      preheader,
      bodyHtml,
      unsubscribeLink: ctx.unsubscribeLink,
    }),
    "html body",
  );

  const textBody = sweep(
    renderTextLayout({
      title: subject,
      lines: bodyLines,
      unsubscribeLink: ctx.unsubscribeLink,
    }),
    "text body",
  );

  return { subject, preheader, html, text: textBody };
}

/**
 * Flat-argument form of render(), for callers that already hold a bag of token
 * strings — the campaign sender builds exactly that shape per recipient.
 *
 * Identical guarantees: it goes through render(), so a missing unsubscribe link
 * still throws and no {{token}} survives. Empty strings count as absent, which
 * is what lets a sender emit `showDate: ""` for an unconfirmed date and get
 * "announced soon" instead of a blank line.
 */
export type RenderTemplateOptions = TokenValues & {
  subject?: string | null;
  preheader?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  /**
   * Accepted so the sender can pass its whole context object without picking
   * fields apart. The shell derives both of these itself.
   */
  campaignName?: string | null;
  siteUrl?: string | null;
};

export function renderTemplate(
  key: TemplateKey,
  { subject, preheader, bodyHtml, bodyText, campaignName: _c, siteUrl: _s, ...tokens }:
    RenderTemplateOptions,
): RenderedEmail {
  return render({ template: key, tokens, subject, preheader, bodyHtml, bodyText });
}

/* ---------------------------------------------------------------- preview */

/**
 * Sample values for the composer's preview pane and for the send-test button.
 *
 * Every value is visibly a sample. Nothing in here should ever be mistaken for a
 * confirmed fact if it leaks into a real send — the date and the winner name are
 * both marked, because those are exactly the two the old site gets wrong
 * (SITE-AUDIT §7) and the two that no one may invent.
 */
export const SAMPLE_TOKENS: Omit<TokenValues, "unsubscribeLink"> = {
  firstName: "Alex",
  showTitle: "Drop That Mike",
  showDate: "Tuesday 12 August, 8:00 PM (sample)",
  // Earlier than showDate on purpose: the preview is where someone notices that
  // these two are different moments.
  deadlineDate: "Friday 8 August, 11:59 PM (sample)",
  prizeAmount: 1000,
  winnerName: "Sample Winner",
};

/**
 * Render a template with sample data. The unsubscribe link points at the real
 * route with an obviously invalid token, so a preview cannot unsubscribe anyone
 * and the link still renders and lays out exactly as it will in a live send.
 */
export function renderPreview(
  key: TemplateKey,
  overrides: Partial<TokenValues> = {},
): RenderedEmail {
  return render({
    template: key,
    tokens: {
      ...SAMPLE_TOKENS,
      unsubscribeLink: siteUrl("/unsubscribe/preview-token-not-valid"),
      ...overrides,
    },
  });
}
