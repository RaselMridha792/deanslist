import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { AdminPageHeader, EmptyState } from "@/components/admin/crud";
import { VisitorsChart, type ChartPoint } from "@/components/admin/analytics/VisitorsChart";
import {
  RANGES,
  RANGE_KEYS,
  describeBucket,
  firstRecorded,
  getBreakdown,
  getSeries,
  getTotals,
  parseRange,
  type BreakdownRow,
  type RangeKey,
} from "@/lib/analytics/queries";
import { geoStatus } from "@/lib/analytics/geo";
import { RETENTION_DAYS, SITE_TZ } from "@/lib/analytics/collect";
import { getGoogleAnalyticsId } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Who visits the public site, from where, and what they read.
 *
 * Counted by the site itself (src/app/api/collect/route.ts): no cookies, no
 * stored addresses, and everyone counted, including the visitors who never
 * answer the cookie banner and so never appear in Google Analytics. That is
 * why the two will not agree, and the note at the bottom says so rather than
 * leaving the client to wonder which one is wrong.
 */

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The one colour a magnitude bar uses, the same as the chart's visitors line. */
const BAR = "#f5503f";

const num = (n: number) =>
  n >= 10_000
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
    : n.toLocaleString("en-US");

function change(current: number, previous: number, previousLabel: string) {
  if (previous === 0) return current === 0 ? null : { text: `nothing to compare with in ${previousLabel}`, up: false };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: `no change on ${previousLabel}`, up: false };
  // Up is good here, so up is the only direction that gets colour. A fall is
  // stated plainly, not painted red: it is information, not an alarm.
  return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% on ${previousLabel}`, up: pct > 0 };
}

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  if (!code) return "Unknown";
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const DEVICE_NAMES: Record<string, string> = { mobile: "Phone", tablet: "Tablet", desktop: "Computer" };

export default async function AnalyticsPage({ searchParams }: Props) {
  await requireRole("EDITOR");
  const params = await searchParams;
  const range = parseRange(Array.isArray(params.range) ? params.range[0] : params.range);
  const def = RANGES[range];

  const since = await firstRecorded();

  if (!since) {
    return (
      <>
        <AdminPageHeader
          title="Analytics"
          description="Visitors to the public site: how many, where they came from, and what they read."
        />
        <div className="mt-8">
          <EmptyState
            title="No visits recorded yet"
            body="Counting starts with the next visit to the public site. Visits by staff signed in to this dashboard are not counted, so open the site in a private window to see one arrive."
          />
        </div>
      </>
    );
  }

  const [totals, series, pages, sources, campaigns, countries, devices, browsers, systems, geo, gaId] =
    await Promise.all([
      getTotals(range),
      getSeries(range),
      getBreakdown(range, "pages"),
      getBreakdown(range, "sources"),
      getBreakdown(range, "campaigns"),
      getBreakdown(range, "countries"),
      getBreakdown(range, "devices"),
      getBreakdown(range, "browsers"),
      getBreakdown(range, "os"),
      geoStatus(),
      getGoogleAnalyticsId(),
    ]);

  const points: ChartPoint[] = series.map((p) => ({ ...p, ...describeBucket(p.key, def.unit) }));

  const tiles = [
    {
      label: "Visitors",
      value: num(totals.visitors),
      delta: change(totals.visitors, totals.prevVisitors, def.previous),
      note: "each person once a day",
    },
    {
      label: "Page views",
      value: num(totals.views),
      delta: change(totals.views, totals.prevViews, def.previous),
    },
    {
      label: "Pages per visitor",
      value: totals.visitors ? (totals.views / totals.visitors).toFixed(1) : "0",
    },
    {
      label: "On the site now",
      value: num(totals.live),
      note: "in the last 5 minutes",
    },
  ];

  const dateFmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: SITE_TZ });

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="Visitors to the public site: how many, where they came from, and what they read. Counted on this server, with no cookies."
      />

      <RangeTabs current={range} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-5">
            <p className="text-xs uppercase tracking-widest text-admin-faint">{t.label}</p>
            <p className="mt-2 font-display text-4xl text-admin-text">{t.value}</p>
            {t.delta && (
              <p className={cn("mt-1 text-xs", t.delta.up ? "text-admin-ok" : "text-admin-faint")}>{t.delta.text}</p>
            )}
            {t.note && <p className="mt-1 text-[11px] text-admin-faint">{t.note}</p>}
          </div>
        ))}
      </div>

      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs uppercase tracking-widest text-admin-faint">Visitors and page views</h2>
          <p className="text-[11px] text-admin-faint">
            {def.unit === "hour" ? "By hour" : def.unit === "month" ? "By month" : "By day"}, New York time
          </p>
        </div>
        <div className="mt-4">
          <VisitorsChart points={points} />
        </div>

        <details className="mt-4 border-t-2 border-admin-line pt-3">
          <summary className="cursor-pointer text-xs uppercase tracking-widest text-admin-muted hover:text-admin-text">
            Show the numbers
          </summary>
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-admin-faint">
                  <th className="py-2 pr-4 font-normal">
                    {def.unit === "hour" ? "Hour" : def.unit === "month" ? "Month" : "Day"}
                  </th>
                  <th className="py-2 pr-4 text-right font-normal">Visitors</th>
                  <th className="py-2 text-right font-normal">Page views</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.key} className="border-t border-admin-line">
                    <td className="py-1.5 pr-4 text-admin-muted">{p.long}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-admin-text">{p.visitors.toLocaleString("en-US")}</td>
                    <td className="py-1.5 text-right tabular-nums text-admin-muted">{p.views.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="Most read pages"
          rows={pages.map((r) => ({
            label: r.label,
            value: r.visitors,
            hint: `${num(r.views)} ${r.views === 1 ? "view" : "views"}`,
          }))}
          empty="No page views in this period."
        />
        <Breakdown
          title="Where visitors came from"
          note="Counted on the first page of each visit."
          rows={sources.map((r) => ({
            label: r.label,
            value: r.visitors,
            hint: r.label === "Direct" ? "typed, bookmarked, or an app that hides it" : undefined,
          }))}
          empty="No arrivals in this period."
        />
        <Breakdown
          title="Countries"
          rows={countries.map((r) => ({ label: countryName(r.label), value: r.visitors, hint: r.label || undefined }))}
          empty="No visits in this period."
        />
        <Breakdown
          title="Campaigns"
          note="Links tagged with utm_campaign, such as the ones in ads and emails."
          rows={campaigns.map((r) => ({ label: r.label, value: r.visitors }))}
          empty="No tagged links were followed in this period. Add ?utm_campaign=name to a link in an ad or email to see it here."
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Breakdown
          title="Devices"
          rows={devices.map((r) => ({ label: DEVICE_NAMES[r.label] ?? r.label, value: r.visitors }))}
          empty="No visits in this period."
          share={totals.visitors}
        />
        <Breakdown
          title="Browsers"
          rows={browsers.map((r: BreakdownRow) => ({ label: r.label, value: r.visitors }))}
          empty="No visits in this period."
          share={totals.visitors}
        />
        <Breakdown
          title="Operating systems"
          rows={systems.map((r) => ({ label: r.label, value: r.visitors }))}
          empty="No visits in this period."
          share={totals.visitors}
        />
      </div>

      <section className="card mt-4 p-5">
        <h2 className="text-xs uppercase tracking-widest text-admin-faint">How this is counted</h2>
        <ul className="mt-3 max-w-[80ch] list-disc space-y-2 pl-5 text-sm text-admin-muted">
          <li>
            Counting started on {dateFmt(since)}. A visitor is one person on one day: someone who comes back tomorrow
            is counted again, because nothing is kept that could recognise them.
          </li>
          <li>
            No cookies and no stored IP addresses, so every visitor is counted, including those who never answer the
            cookie banner. Automated software and staff signed in to this dashboard are left out. Page views are kept
            for {Math.round(RETENTION_DAYS / 365)} years.
          </li>
          {gaId && (
            <li>
              Google Analytics ({gaId}) has its own reports at{" "}
              <a
                href="https://analytics.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-brand-onDark underline underline-offset-4"
              >
                analytics.google.com
              </a>
              . Its numbers will be lower than these: it only counts visitors who choose Allow on the banner.
            </li>
          )}
          <li>
            {geo.available ? (
              <>
                Countries are looked up on this server, and the address is not kept or sent anywhere.{" "}
                <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="text-brand-onDark underline underline-offset-4">
                  IP Geolocation by DB-IP
                </a>
                {geo.updated ? `, data from ${dateFmt(geo.updated)}` : ""}.
              </>
            ) : (
              <span className="text-admin-text">
                The country lookup is not installed on this server, so every visit shows its country as Unknown.
              </span>
            )}
          </li>
        </ul>
      </section>
    </>
  );
}

function RangeTabs({ current }: { current: RangeKey }) {
  return (
    <nav aria-label="Date range" className="mt-6 flex flex-wrap gap-2">
      {RANGE_KEYS.map((key) => (
        <Link
          key={key}
          href={`/admin/analytics?range=${key}`}
          aria-current={key === current ? "page" : undefined}
          className={cn(
            "border-2 px-3 py-1.5 text-xs uppercase tracking-wider transition-colors duration-200 ease-dl",
            key === current
              ? "border-brand-onDark bg-admin-raised text-admin-text"
              : "border-admin-line text-admin-muted hover:bg-admin-raised hover:text-admin-text",
          )}
        >
          {RANGES[key].label}
        </Link>
      ))}
    </nav>
  );
}

function Breakdown({
  title,
  note,
  rows,
  empty,
  share,
}: {
  title: string;
  note?: string;
  rows: { label: string; value: number; hint?: string }[];
  empty: string;
  /** When set, each row also shows its share of this total. */
  share?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs uppercase tracking-widest text-admin-faint">{title}</h2>
        {rows.length > 0 && <span className="text-[11px] text-admin-faint">Visitors</span>}
      </div>
      {note && <p className="mt-1 text-[11px] text-admin-faint">{note}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-admin-faint">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-admin-text" title={r.label}>
                  {r.label}
                  {r.hint && <span className="ml-2 text-xs text-admin-faint">{r.hint}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-admin-muted">
                  {num(r.value)}
                  {share ? <span className="ml-2 text-admin-faint">{Math.round((r.value / share) * 100)}%</span> : null}
                </span>
              </div>
              <span className="mt-1.5 block h-1.5 bg-admin-raised">
                <span className="block h-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: BAR }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
