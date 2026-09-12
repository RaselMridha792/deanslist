import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { classifySource, cleanUtm, describeAgent, referrerHost } from "@/lib/analytics/classify";
import { lookupCountry } from "@/lib/analytics/geo";

/**
 * Recording one page view.
 *
 * What a visitor's browser sends is the path, the referrer on the first page,
 * any campaign tags and whether the screen is touch. What the server adds is
 * the address and the user agent, which arrive with every request anyway. Of
 * those, the row keeps a country, three coarse labels and a hash; the address
 * and the user agent themselves are used and dropped in this function.
 */

/** The client is in New York, so a "day" on the analytics screen is New York's day. */
export const SITE_TZ = "America/New_York";

/**
 * Two years. Enough to compare this year's shows with last year's; not so long
 * that the table becomes the thing the backups are made of.
 */
export const RETENTION_DAYS = 731;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-09-13", the date in New York right now. */
export function siteDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

let cachedSalt: { day: string; salt: string } | null = null;

/**
 * Today's salt, made on the first visit of the day.
 *
 * The salt rotates at midnight in New York, the same boundary the screen draws
 * its days on, so one person reading at 7:30 and again at 8:30 in the evening is
 * one visitor that day rather than two (UTC's midnight falls at 8 PM there).
 *
 * Making the row is also the moment to tidy: yesterday's salt is deleted, which
 * is what makes yesterday's hashes impossible to reverse, and visits past the
 * retention window go with it. Once a day, with no scheduler to keep running.
 */
async function saltFor(day: string): Promise<string> {
  if (cachedSalt?.day === day) return cachedSalt.salt;

  const existing = await prisma.analyticsSalt.findUnique({ where: { day } });
  if (existing) {
    cachedSalt = { day, salt: existing.salt };
    return existing.salt;
  }

  const salt = randomBytes(32).toString("hex");
  try {
    await prisma.analyticsSalt.create({ data: { day, salt } });
  } catch {
    // Two first-visits of the day raced and the other one won. Use its salt:
    // two salts for one day would count the same person twice.
    const winner = await prisma.analyticsSalt.findUnique({ where: { day } });
    if (!winner) throw new Error("Could not create or read today's analytics salt.");
    cachedSalt = { day, salt: winner.salt };
    return winner.salt;
  }

  cachedSalt = { day, salt };
  await Promise.all([
    prisma.analyticsSalt.deleteMany({ where: { day: { lt: day } } }),
    prisma.pageView.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * DAY_MS) } },
    }),
  ]).catch((error) => {
    // Housekeeping that fails is retried tomorrow; the visit still counts.
    console.error("[analytics] daily cleanup failed:", error);
  });
  return salt;
}

export type PageViewInput = {
  path: string;
  isEntry: boolean;
  referrer: unknown;
  utm: unknown;
  touch: boolean;
  ip: string;
  userAgent: string;
  /** This site's own hostnames, so internal links are not counted as a source. */
  siteHosts: string[];
};

export async function recordPageView(input: PageViewInput): Promise<void> {
  const day = siteDay();
  const salt = await saltFor(day);

  const visitorHash = createHash("sha256")
    .update(`${salt}|${input.ip}|${input.userAgent}`)
    .digest("hex")
    .slice(0, 32);

  const { device, browser, os } = describeAgent(input.userAgent, input.touch);
  const country = await lookupCountry(input.ip);

  // Where someone came from is a property of their arrival, so it is recorded on
  // the first page of the visit and nowhere else.
  let source: string | null = null;
  let refHost: string | null = null;
  let utm = { source: null as string | null, medium: null as string | null, campaign: null as string | null };
  if (input.isEntry) {
    refHost = referrerHost(input.referrer, input.siteHosts);
    utm = cleanUtm(input.utm);
    source = classifySource({ utmSource: utm.source, referrerHost: refHost, userAgent: input.userAgent });
  }

  await prisma.pageView.create({
    data: {
      path: input.path,
      visitorHash,
      isEntry: input.isEntry,
      source,
      referrerHost: refHost,
      utmSource: utm.source,
      utmMedium: utm.medium,
      utmCampaign: utm.campaign,
      country,
      device,
      browser,
      os,
    },
  });
}
