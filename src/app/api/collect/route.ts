import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { isBot, isTrackablePath, normalizeIp, normalizePath } from "@/lib/analytics/classify";
import { recordPageView } from "@/lib/analytics/collect";

/**
 * The page view beacon (src/components/site/PageViewBeacon.tsx) posts here.
 *
 * Public and unauthenticated by necessity, so it is written on the assumption
 * that most of what reaches it is not a person reading the site:
 *
 *   - it answers 204 to everything, recorded or not. A bot learns nothing about
 *     which of its requests counted, and a real browser has nothing to wait for.
 *   - software is filtered here on the user agent, not in the page, where a
 *     script could simply skip the check.
 *   - a post from another site's page is dropped. Browsers label every request
 *     with where it came from (Sec-Fetch-Site), so a page elsewhere cannot pad
 *     these numbers through its visitors' browsers.
 *   - each address gets 60 views a minute. Far above anyone reading, far below
 *     anything that would matter to the database.
 *   - staff signed in to the dashboard are not counted, so the client checking
 *     their own site forty times a day does not become their best audience.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 4096;

const text = (max: number) => z.string().max(max).nullish();

const bodySchema = z.object({
  /** location.pathname */
  p: z.string().max(2048),
  /** First page of this page load. */
  e: z.boolean().optional().default(false),
  /** document.referrer, first page only. */
  r: text(2048),
  u: z.object({ source: text(500), medium: text(500), campaign: text(500) }).nullish(),
  /** navigator.maxTouchPoints > 1 */
  t: z.boolean().optional().default(false),
});

const done = () => new NextResponse(null, { status: 204 });

/**
 * The visitor's address as Caddy reports it.
 *
 * Caddy trusts no proxy in front of it, so it replaces X-Forwarded-For with the
 * address it actually received the connection from. The last entry is taken
 * rather than the first so that this stays right behind a proxy that appends.
 * X-Real-IP is deliberately ignored: Caddy passes a client-supplied one through
 * untouched, which would let anyone choose their own country and rate limit.
 */
function clientIp(req: NextRequest): string {
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return normalizeIp(chain[chain.length - 1] ?? "unknown");
}

function fromThisSite(req: NextRequest): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  // Older browsers send no Sec-Fetch-Site. Fall back to Origin, and allow a
  // request with neither: rate limiting still applies to it.
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function siteHosts(req: NextRequest): string[] {
  const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host")];
  try {
    hosts.push(new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname);
  } catch {
    // Unset in some local setups; the request's own host still covers it.
  }
  return hosts.filter((h): h is string => Boolean(h)).map((h) => h.split(":")[0].toLowerCase());
}

export async function POST(req: NextRequest) {
  if (!fromThisSite(req)) return done();

  const userAgent = req.headers.get("user-agent") ?? "";
  if (isBot(userAgent)) return done();

  const ip = clientIp(req);
  if (!rateLimit(`collect:${ip}`, 60, 60_000).ok) return done();

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return done();
  const raw = await req.text();
  if (raw.length > MAX_BODY) return done();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return done();
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return done();

  const path = normalizePath(parsed.data.p);
  if (!path || !isTrackablePath(path)) return done();

  if (await getSession()) return done();

  try {
    await recordPageView({
      path,
      isEntry: parsed.data.e,
      referrer: parsed.data.r,
      utm: parsed.data.u,
      touch: parsed.data.t,
      ip,
      userAgent,
      siteHosts: siteHosts(req),
    });
  } catch (error) {
    // A lost page view is not worth a failed request. Say so in the log, where a
    // database outage will already be announcing itself louder than this.
    console.error("[analytics] page view not recorded:", error);
  }
  return done();
}
