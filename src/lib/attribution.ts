/**
 * Where a visitor came from, carried from the page they landed on to the page
 * they convert on.
 *
 * The problem this solves is specific to paid traffic. An ad click arrives at
 * `/?utm_source=meta&utm_campaign=weekly-show&utm_content=reel-a&fbclid=...`,
 * and the visitor then reads a bit, clicks through to `/enter`, and submits
 * there. By that point the URL carries none of it. Reading the parameters at
 * submit time therefore attributes almost every paid lead to nothing, which is
 * exactly the failure that makes an ad account impossible to optimise: the
 * campaign looks like it produced no entries.
 *
 * So the values are captured on first sight and kept for the session.
 *
 * sessionStorage rather than a cookie, deliberately. It is not sent to any
 * server on its own, it dies with the tab, and it is not shared across sites,
 * so it stays out of consent-banner territory: this is the visitor's own
 * navigation, held for the length of one visit, and used only to label an entry
 * the visitor is about to submit anyway.
 *
 * First touch wins. A visitor who arrives from an ad and later returns through
 * a shared link inside the same tab is still that ad's lead; overwriting on the
 * second visit would credit the campaign that did the least work.
 */

const KEY = "dl.attribution";

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  clickId?: string;
  /** The page the visitor first landed on. Not the referrer: the entry point. */
  landingPath?: string;
};

/** Anything longer than this is not a campaign name, it is someone probing. */
const MAX = 200;

function clean(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, MAX);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Read the current URL, and store what it carries if nothing is stored yet.
 *
 * Safe to call on every page: it is a no-op once a value exists, and a no-op
 * on the server. It also survives storage being unavailable, which happens in
 * private windows and wherever a browser is set to block site data — an
 * attribution failure must never take a form down with it.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;

  try {
    if (window.sessionStorage.getItem(KEY)) return;

    const q = new URLSearchParams(window.location.search);
    const data: Attribution = {
      utmSource: clean(q.get("utm_source")),
      utmMedium: clean(q.get("utm_medium")),
      utmCampaign: clean(q.get("utm_campaign")),
      utmContent: clean(q.get("utm_content")),
      utmTerm: clean(q.get("utm_term")),
      // fbclid is Meta, gclid is Google. One column, because a lead comes from
      // one click and storing which platform it was is what utm_source is for.
      clickId: clean(q.get("fbclid")) ?? clean(q.get("gclid")),
      landingPath: window.location.pathname,
    };

    // Nothing worth keeping if the visit carries no campaign markers at all.
    // Storing a bare landingPath would make the next real ad click a no-op,
    // because the "already stored" check above would find it.
    const hasMarkers = Object.entries(data).some(
      ([k, v]) => k !== "landingPath" && Boolean(v),
    );
    if (!hasMarkers) return;

    window.sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage blocked. The visit is simply unattributed.
  }
}

/** What was captured, for a form to send along with its own fields. */
export function readAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Attribution) : {};
  } catch {
    return {};
  }
}
