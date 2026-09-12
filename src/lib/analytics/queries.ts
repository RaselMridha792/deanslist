import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SITE_TZ } from "@/lib/analytics/collect";

/**
 * The questions the analytics screen asks of PageView.
 *
 * Every range is drawn in New York time, the client's time: "today" starts at
 * midnight there, and a day on the chart is a day there. The boundaries are
 * computed by Postgres, which knows when the clocks change, rather than by
 * adding hours in JavaScript, which does not.
 *
 * Each range is compared with like. "7 days" is the six full days before today
 * plus today so far, and the period it is measured against is the same span a
 * week earlier, cut off at the same time of day. Comparing a half-finished
 * today with a whole yesterday would report a fall every morning.
 *
 * Only constant SQL from this file is ever spliced into a query: the range
 * definitions and the dimension expressions. A request can choose between
 * those keys and reach nothing else.
 */

export const RANGE_KEYS = ["today", "7d", "30d", "90d", "12m"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export type Unit = "hour" | "day" | "month";

type RangeDef = {
  label: string;
  unit: Unit;
  /** The first bucket, in New York wall time, given n.now_local. */
  start: string;
  /** How far back the comparison period sits. */
  shift: string;
  /** How the comparison period is named under a figure. */
  previous: string;
};

export const RANGES: Record<RangeKey, RangeDef> = {
  today: {
    label: "Today",
    unit: "hour",
    start: "date_trunc('day', n.now_local)",
    shift: "1 day",
    previous: "yesterday by this time",
  },
  "7d": {
    label: "7 days",
    unit: "day",
    start: "date_trunc('day', n.now_local) - interval '6 days'",
    shift: "7 days",
    previous: "the week before",
  },
  "30d": {
    label: "30 days",
    unit: "day",
    start: "date_trunc('day', n.now_local) - interval '29 days'",
    shift: "30 days",
    previous: "the 30 days before",
  },
  "90d": {
    label: "90 days",
    unit: "day",
    start: "date_trunc('day', n.now_local) - interval '89 days'",
    shift: "90 days",
    previous: "the 90 days before",
  },
  "12m": {
    label: "12 months",
    unit: "month",
    start: "date_trunc('month', n.now_local) - interval '11 months'",
    shift: "12 months",
    previous: "the year before",
  },
};

export function parseRange(raw: unknown): RangeKey {
  return RANGE_KEYS.includes(raw as RangeKey) ? (raw as RangeKey) : "7d";
}

const TZ = Prisma.raw(`'${SITE_TZ}'`);

/** One row: the period's edges in New York time and in the UTC the table stores. */
function bounds(key: RangeKey): Prisma.Sql {
  const r = RANGES[key];
  const shift = Prisma.raw(`interval '${r.shift}'`);
  return Prisma.sql`
    SELECT
      n.now_local,
      s.start_local,
      (s.start_local AT TIME ZONE ${TZ}) AT TIME ZONE 'UTC' AS start_utc,
      now() AT TIME ZONE 'UTC' AS end_utc,
      ((s.start_local - ${shift}) AT TIME ZONE ${TZ}) AT TIME ZONE 'UTC' AS prev_start_utc,
      ((n.now_local - ${shift}) AT TIME ZONE ${TZ}) AT TIME ZONE 'UTC' AS prev_end_utc
    FROM (SELECT now() AT TIME ZONE ${TZ} AS now_local) n
    CROSS JOIN LATERAL (SELECT ${Prisma.raw(r.start)} AS start_local) s
  `;
}

export type Totals = {
  visitors: number;
  views: number;
  prevVisitors: number;
  prevViews: number;
  /** Visitors seen in the last five minutes, whatever the range. */
  live: number;
};

export async function getTotals(key: RangeKey): Promise<Totals> {
  const rows = await prisma.$queryRaw<
    { visitors: number; views: number; prev_visitors: number; prev_views: number; live: number }[]
  >`
    WITH b AS (${bounds(key)})
    SELECT
      count(*) FILTER (WHERE pv."createdAt" >= b.start_utc)::int AS views,
      count(DISTINCT pv."visitorHash") FILTER (WHERE pv."createdAt" >= b.start_utc)::int AS visitors,
      count(*) FILTER (
        WHERE pv."createdAt" >= b.prev_start_utc AND pv."createdAt" < b.prev_end_utc
      )::int AS prev_views,
      count(DISTINCT pv."visitorHash") FILTER (
        WHERE pv."createdAt" >= b.prev_start_utc AND pv."createdAt" < b.prev_end_utc
      )::int AS prev_visitors,
      count(DISTINCT pv."visitorHash") FILTER (
        WHERE pv."createdAt" >= b.end_utc - interval '5 minutes'
      )::int AS live
    FROM b
    LEFT JOIN "PageView" pv
      ON pv."createdAt" >= LEAST(b.prev_start_utc, b.end_utc - interval '5 minutes')
  `;
  const r = rows[0];
  return {
    visitors: r?.visitors ?? 0,
    views: r?.views ?? 0,
    prevVisitors: r?.prev_visitors ?? 0,
    prevViews: r?.prev_views ?? 0,
    live: r?.live ?? 0,
  };
}

export type SeriesPoint = { key: string; visitors: number; views: number };

/** One point per hour, day or month of the range, zeros included. */
export async function getSeries(key: RangeKey): Promise<SeriesPoint[]> {
  const unit = Prisma.raw(`'${RANGES[key].unit}'`);
  const step = Prisma.raw(`interval '1 ${RANGES[key].unit}'`);
  return prisma.$queryRaw<SeriesPoint[]>`
    WITH b AS (${bounds(key)}),
    buckets AS (
      SELECT generate_series(b.start_local, date_trunc(${unit}, b.now_local), ${step}) AS bucket
      FROM b
    ),
    counted AS (
      SELECT
        date_trunc(${unit}, (pv."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}) AS bucket,
        count(*)::int AS views,
        count(DISTINCT pv."visitorHash")::int AS visitors
      FROM "PageView" pv, b
      WHERE pv."createdAt" >= b.start_utc
      GROUP BY 1
    )
    SELECT
      to_char(buckets.bucket, 'YYYY-MM-DD"T"HH24:MI') AS key,
      coalesce(counted.visitors, 0)::int AS visitors,
      coalesce(counted.views, 0)::int AS views
    FROM buckets
    LEFT JOIN counted ON counted.bucket = buckets.bucket
    ORDER BY buckets.bucket
  `;
}

export type Dimension = "pages" | "sources" | "campaigns" | "countries" | "devices" | "browsers" | "os";

const DIMENSIONS: Record<Dimension, { expr: string; entriesOnly: boolean; where?: string; limit: number }> = {
  pages: { expr: `pv.path`, entriesOnly: false, limit: 10 },
  // Counted on arrivals only: a visitor who came from Facebook and read five
  // pages is one visitor from Facebook, not five.
  sources: { expr: `coalesce(pv.source, 'Direct')`, entriesOnly: true, limit: 10 },
  campaigns: { expr: `pv."utmCampaign"`, entriesOnly: true, where: `pv."utmCampaign" IS NOT NULL`, limit: 10 },
  countries: { expr: `coalesce(pv.country, '')`, entriesOnly: false, limit: 10 },
  devices: { expr: `pv.device`, entriesOnly: false, limit: 3 },
  browsers: { expr: `coalesce(pv.browser, 'Other')`, entriesOnly: false, limit: 6 },
  os: { expr: `coalesce(pv.os, 'Other')`, entriesOnly: false, limit: 6 },
};

export type BreakdownRow = { label: string; visitors: number; views: number };

export async function getBreakdown(key: RangeKey, dimension: Dimension): Promise<BreakdownRow[]> {
  const d = DIMENSIONS[dimension];
  const filters = [Prisma.sql`pv."createdAt" >= b.start_utc`];
  if (d.entriesOnly) filters.push(Prisma.sql`pv."isEntry"`);
  if (d.where) filters.push(Prisma.raw(d.where));

  return prisma.$queryRaw<BreakdownRow[]>`
    WITH b AS (${bounds(key)})
    SELECT
      ${Prisma.raw(d.expr)} AS label,
      count(DISTINCT pv."visitorHash")::int AS visitors,
      count(*)::int AS views
    FROM "PageView" pv, b
    WHERE ${Prisma.join(filters, " AND ")}
    GROUP BY 1
    ORDER BY visitors DESC, views DESC, label ASC
    LIMIT ${d.limit}
  `;
}

/** When counting began, for "counting since" and for the empty state. */
export async function firstRecorded(): Promise<Date | null> {
  const row = await prisma.pageView.findFirst({ orderBy: { id: "asc" }, select: { createdAt: true } });
  return row?.createdAt ?? null;
}

/**
 * "2026-09-13T21:00" as the chart and the table name it.
 *
 * The key is already New York wall time, so it is read as plain numbers and
 * formatted in UTC. Formatting it in a time zone would shift it a second time.
 */
export function describeBucket(key: string, unit: Unit): { label: string; long: string } {
  const [datePart, timePart = "00:00"] = key.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const hour = Number(timePart.slice(0, 2));
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(date);

  if (unit === "hour") {
    const h12 = ((hour + 11) % 12) + 1;
    const half = hour < 12 ? "AM" : "PM";
    return { label: `${h12} ${half}`, long: `${fmt({ weekday: "short", month: "short", day: "numeric" })}, ${h12}:00 ${half}` };
  }
  if (unit === "month") {
    return { label: fmt({ month: "short" }), long: fmt({ month: "long", year: "numeric" }) };
  }
  return { label: fmt({ month: "short", day: "numeric" }), long: fmt({ weekday: "long", month: "long", day: "numeric" }) };
}
