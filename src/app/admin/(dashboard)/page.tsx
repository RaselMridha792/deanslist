import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function AdminOverview() {
  await requireRole("REVIEWER");

  const since7 = new Date(Date.now() - 7 * DAY);
  const since30 = new Date(Date.now() - 30 * DAY);
  const prev7 = new Date(Date.now() - 14 * DAY);

  const [
    total,
    contestants,
    optedIn,
    last7,
    prior7,
    newCount,
    byType,
    byCountry,
    recent,
    unverifiedStats,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { type: "CONTESTANT" } }),
    prisma.lead.count({ where: { marketingOptIn: true, unsubscribedAt: null } }),
    prisma.lead.count({ where: { createdAt: { gte: since7 } } }),
    prisma.lead.count({ where: { createdAt: { gte: prev7, lt: since7 } } }),
    prisma.lead.count({ where: { status: "NEW" } }),
    prisma.lead.groupBy({ by: ["type"], _count: true, orderBy: { _count: { type: "desc" } } }),
    prisma.lead.groupBy({
      by: ["country"],
      _count: true,
      // `not: null` alone lets empty strings through, and they group into a row
      // with no label and a filter link that matches nothing.
      where: { country: { notIn: [""] }, createdAt: { gte: since30 } },
      orderBy: { _count: { country: "desc" } },
      take: 6,
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        type: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.siteStat.count({ where: { verified: false, active: true } }),
  ]);

  const delta = prior7 === 0 ? null : Math.round(((last7 - prior7) / prior7) * 100);

  const cards = [
    { label: "Total leads", value: total, href: "/admin/leads" },
    {
      label: "Needs review",
      value: newCount,
      href: "/admin/leads?status=NEW",
      accent: newCount > 0,
    },
    { label: "Contest entries", value: contestants, href: "/admin/leads?type=CONTESTANT" },
    {
      label: "Email list",
      value: optedIn,
      href: "/admin/leads?optIn=yes",
      note: "consented, not unsubscribed",
    },
  ];

  return (
    <>
      <h1 className="font-display text-3xl tracking-wide">Overview</h1>
      <p className="mt-2 text-sm text-neutral-700">
        Everything captured since the new site went live.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="card-interactive block p-5"
          >
            <p className="text-xs uppercase tracking-widest text-neutral-600">{c.label}</p>
            <p
              className={`mt-2 font-display text-4xl ${
                c.accent ? "text-brand-onLight" : "text-brand"
              }`}
            >
              {c.value.toLocaleString("en-US")}
            </p>
            {c.note && <p className="mt-1 text-[11px] text-neutral-400">{c.note}</p>}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-600">Last 7 days</p>
          <p className="mt-2 font-display text-4xl text-brand">{last7}</p>
          {delta !== null && (
            <p
              className={`mt-1 text-xs ${
                delta >= 0 ? "text-emerald-700" : "text-neutral-600"
              }`}
            >
              {delta >= 0 ? "+" : ""}
              {delta}% vs the 7 days before
            </p>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <p className="text-xs uppercase tracking-widest text-neutral-600">By type</p>
          <div className="mt-3 space-y-2">
            {byType.length === 0 && <p className="text-sm text-neutral-400">No leads yet.</p>}
            {byType.map((t) => {
              const n = typeof t._count === "number" ? t._count : 0;
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={t.type} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs uppercase tracking-wider text-neutral-700">
                    {t.type.toLowerCase()}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden bg-surface">
                    <span
                      className="block h-full bg-brand"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-600">
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* A standing reminder, not decoration: an unverified figure on the public
          site is an advertising claim nobody has checked. */}
      {unverifiedStats > 0 && (
        <div className="mt-4 border border-brand/30 bg-brand/5 p-5">
          <p className="text-sm text-ink">
            <span className="font-semibold text-brand">
              {unverifiedStats} unconfirmed statistic{unverifiedStats > 1 ? "s" : ""}
            </span>{" "}
            {unverifiedStats > 1 ? "are" : "is"} hidden from the public site until someone
            confirms the number. The old site&apos;s counter renders &quot;.7Mil+&quot;, so
            the subscriber figure has never been verified.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <p className="border-b border-rule px-5 py-4 text-xs uppercase tracking-widest text-neutral-600">
            Latest submissions
          </p>
          {recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-neutral-400">
              Nothing yet. Submissions from every public form land here.
            </p>
          ) : (
            <ul>
              {recent.map((r) => (
                <li key={r.id} className="border-b border-rule last:border-0">
                  <Link
                    href={`/admin/leads/${r.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">
                        {r.firstName} {r.lastName ?? ""}
                      </span>
                      <span className="block truncate text-xs text-neutral-600">{r.email}</span>
                    </span>
                    <span className="shrink-0 text-xs text-neutral-600">
                      {r.createdAt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-600">
            Top countries · 30 days
          </p>
          {byCountry.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">No country data yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {byCountry.map((c) => (
                <li key={c.country} className="flex justify-between text-sm">
                  <Link
                    href={`/admin/leads?country=${encodeURIComponent(c.country ?? "")}`}
                    className="text-neutral-700 transition-colors hover:text-brand"
                  >
                    {c.country}
                  </Link>
                  <span className="tabular-nums text-neutral-600">
                    {typeof c._count === "number" ? c._count : 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
