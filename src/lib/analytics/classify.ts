/**
 * Turning a raw page view into the few coarse labels the analytics screen
 * counts by.
 *
 * Everything here is a pure function of its arguments — no database, no clock,
 * no request — so each rule can be checked on its own, and so nothing in this
 * file can quietly start keeping more than it returns.
 *
 * The rule throughout is to reduce before storing. A referrer becomes a
 * hostname, a user agent becomes three words, a URL becomes its route. The
 * detail is thrown away here, not filtered later, because data that was never
 * written cannot leak out of a backup.
 */

const MAX_PATH = 300;
const MAX_LABEL = 80;

/**
 * Routes whose last segment is a secret rather than a name.
 *
 * An unsubscribe link carries a signed token in its path; storing it would put
 * a working "unsubscribe this person" link into every analytics row and every
 * backup. The route is what the screen needs, so the route is what is kept.
 * Add a pattern here for any new route that puts a token in the path.
 */
const TOKEN_ROUTES: [RegExp, string][] = [[/^\/unsubscribe\/[^/]+$/, "/unsubscribe/[token]"]];

/**
 * The pathname, and only the pathname.
 *
 * Callers send `location.pathname`, but this does not trust that: a query string
 * or fragment is cut off here too, because either can carry an email address.
 * Returns null for anything that is not a plausible path on this site.
 */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let path = raw.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//")) return null;

  try {
    path = decodeURI(path);
  } catch {
    // A malformed escape is not a real page. Keep the raw form rather than drop
    // the visit; it still counts, it just reads oddly.
  }
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path === "") path = "/";
  if (path.length > MAX_PATH || /[\u0000-\u001f]/.test(path)) return null;

  for (const [pattern, route] of TOKEN_ROUTES) {
    if (pattern.test(path)) return route;
  }
  return path;
}

/** Admin screens and API routes are not visits to the public site. */
export function isTrackablePath(path: string): boolean {
  return !/^\/(admin|api|uploads|_next)(\/|$)/.test(path);
}

// ------------------------------------------------------------------ sources

/**
 * Hostnames that are one recognisable place, named the way the client would
 * name them. Matched on the registrable end of the host, so l.facebook.com,
 * m.facebook.com and lm.facebook.com are all Facebook.
 */
const KNOWN_HOSTS: [RegExp, string][] = [
  // First, because the generic google.* rule below would otherwise claim them.
  [/^(mail\.google\.com|com\.google\.android\.gm)$/, "Gmail"],
  // Android apps report themselves as android-app://<package>.
  [/^com\.facebook\.(katana|orca|lite)$/, "Facebook"],
  [/^com\.instagram\.android$/, "Instagram"],
  [/^com\.google\.android\.youtube$/, "YouTube"],
  [/^com\.google\.android\.googlequicksearchbox$/, "Google"],
  [/^com\.zhiliaoapp\.musically$/, "TikTok"],
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\.com$/, "Yahoo"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch)$/, "Facebook"],
  [/(^|\.)(instagram\.com|instagr\.am)$/, "Instagram"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)(threads\.net|threads\.com)$/, "Threads"],
  [/(^|\.)snapchat\.com$/, "Snapchat"],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
];

/** Campaign tags as people actually type them, folded to the same names. */
const KNOWN_UTM: [RegExp, string][] = [
  [/^(fb|facebook|meta)$/i, "Facebook"],
  [/^(ig|insta|instagram)$/i, "Instagram"],
  [/^(yt|youtube)$/i, "YouTube"],
  [/^google$/i, "Google"],
  [/^(tiktok|tt)$/i, "TikTok"],
  [/^(x|twitter)$/i, "X (Twitter)"],
  [/^(email|e-mail|newsletter|resend)$/i, "Email"],
  [/^(sms|text)$/i, "SMS"],
];

function clip(value: unknown, max = MAX_LABEL): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/[\u0000-\u001f]/g, "").slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

/** The referrer's hostname, without www, or null when there is none worth keeping. */
export function referrerHost(referrer: unknown, siteHosts: string[]): string | null {
  if (typeof referrer !== "string" || referrer.length === 0) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  if (!host) return null;
  // Arriving from our own pages is not a source; it is a new tab or a reload.
  if (siteHosts.some((h) => h.replace(/^www\./, "") === host)) return null;
  if (host === "localhost" || /^(127\.|10\.|192\.168\.)/.test(host)) return null;
  return host.slice(0, 120);
}

export type Utm = { source: string | null; medium: string | null; campaign: string | null };

export function cleanUtm(raw: unknown): Utm {
  const u = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { source: clip(u.source), medium: clip(u.medium), campaign: clip(u.campaign) };
}

/**
 * The one name a visit's arrival is counted under.
 *
 * In order of how much the signal can be trusted to mean what it says:
 *  1. A campaign tag. Someone put it on the link on purpose.
 *  2. The referring site.
 *  3. The in-app browser. Facebook and Instagram open links inside their own
 *     apps and usually send no referrer at all, which would file most of this
 *     site's audience under "Direct". Their user agents name the app, so that
 *     is used — for this site it is the difference between a useful sources
 *     table and a misleading one.
 *  4. Direct: typed, bookmarked, or from somewhere that sends nothing.
 */
export function classifySource(input: {
  utmSource: string | null;
  referrerHost: string | null;
  userAgent: string;
}): string {
  if (input.utmSource) {
    for (const [pattern, name] of KNOWN_UTM) if (pattern.test(input.utmSource)) return name;
    return input.utmSource;
  }
  if (input.referrerHost) {
    for (const [pattern, name] of KNOWN_HOSTS) if (pattern.test(input.referrerHost)) return name;
    return input.referrerHost;
  }
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(input.userAgent)) return "Facebook";
  if (/Instagram/.test(input.userAgent)) return "Instagram";
  return "Direct";
}

// ---------------------------------------------------------- browsers & bots

/**
 * Software rather than people. Checked on the server, where a script cannot
 * decide for itself whether it counts.
 *
 * Link previews are on the list on purpose: pasting the site into WhatsApp or
 * Facebook fetches it once per paste, and none of those fetches is a reader.
 * "Headless" also catches the Playwright suite, so running the tests against
 * the live site does not inflate the numbers the client is reading.
 *
 * "bot" is matched only where a crawler writes it — Googlebot/2.1, PetalBot; —
 * and not as a bare word, which would also catch Cubot phones, whose model
 * name sits in the user agent.
 */
const BOT =
  /[a-z]bot\/|[a-z]bot;|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|facebookexternalhit|facebookcatalog|meta-externalagent|embedly|preview|whatsapp|telegram|discord|slack|skype|vkshare|curl\/|wget|python-|axios|node-fetch|undici|go-http-client|java\/|okhttp|httpclient|scrapy|phantomjs|selenium|puppeteer|playwright/i;

export function isBot(userAgent: string): boolean {
  return userAgent.length < 20 || BOT.test(userAgent);
}

export type Device = "mobile" | "tablet" | "desktop";

/**
 * Three coarse labels, and deliberately nothing finer.
 *
 * No versions: "Chrome 131 on Android 15" plus a country and a time is most of
 * the way to picking one person out of a small site's traffic. "Chrome on
 * Android" is not.
 *
 * `touch` is the page's navigator.maxTouchPoints > 1. An iPad has asked for the
 * desktop site by default since iPadOS 13 and sends a Mac user agent, so the
 * user agent alone files every iPad as a Mac.
 */
export function describeAgent(userAgent: string, touch: boolean) {
  const ua = userAgent;
  const iPadAsMac = /Macintosh/.test(ua) && touch;

  let device: Device = "desktop";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) || iPadAsMac) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile/i.test(ua)) device = "mobile";

  let browser: string | null = null;
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) browser = "Facebook app";
  else if (/Instagram/.test(ua)) browser = "Instagram app";
  else if (/Edg(e|A|iOS)?\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/CriOS\//.test(ua)) browser = "Chrome";
  else if (/FxiOS\/|Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";

  let os: string | null = null;
  if (/Windows NT|Windows Phone/.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua) || iPadAsMac) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return { device, browser, os };
}

/** "::ffff:203.0.113.9" is an IPv4 address wearing IPv6 notation. */
export function normalizeIp(ip: string): string {
  return ip.trim().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, "$1");
}
