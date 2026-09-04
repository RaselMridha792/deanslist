import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/crud";

export const dynamic = "force-dynamic";

/**
 * Hub for the three content areas the client owns outright.
 *
 * Each card leads with the number that matters operationally rather than a row
 * count: how many sponsors are actually on the site, how many statistics are
 * being claimed publicly, how many sections are published. A dashboard that only
 * says "3 statistics" hides the question the client should be asking.
 */
export default async function ContentHub() {
  await requireRole("EDITOR");

  const [
    sponsorsTotal,
    sponsorsActive,
    statsTotal,
    statsLive,
    statsUnverified,
    sectionsTotal,
    sectionsPublished,
  ] = await Promise.all([
    prisma.sponsor.count(),
    prisma.sponsor.count({ where: { active: true } }),
    prisma.siteStat.count(),
    prisma.siteStat.count({ where: { active: true, verified: true } }),
    prisma.siteStat.count({ where: { verified: false } }),
    prisma.pageSection.count(),
    prisma.pageSection.count({ where: { published: true } }),
  ]);

  const cards = [
    {
      href: "/admin/content/sponsors",
      title: "Sponsors",
      blurb:
        "Logos for the homepage strip and the sponsors page. The strip hides itself entirely while none are active.",
      metric: `${sponsorsActive} live`,
      sub:
        sponsorsTotal === 0
          ? "None added yet"
          : `${sponsorsTotal} total · ${sponsorsTotal - sponsorsActive} switched off`,
      warn: false,
    },
    {
      href: "/admin/content/stats",
      title: "Site statistics",
      blurb:
        "The audience and prize figures in the stats band. Only verified figures ever reach the public site.",
      metric: `${statsLive} live`,
      sub:
        statsTotal === 0
          ? "None added yet"
          : statsUnverified > 0
            ? `${statsUnverified} unconfirmed and hidden`
            : `${statsTotal} total, all confirmed`,
      warn: statsUnverified > 0,
    },
    {
      href: "/admin/content/sections",
      title: "Page sections",
      blurb:
        "Editable copy blocks for /about and /rules. Unpublished sections are never shown to visitors.",
      metric: `${sectionsPublished} published`,
      sub:
        sectionsTotal === 0
          ? "None written yet"
          : `${sectionsTotal} total · ${sectionsTotal - sectionsPublished} in draft`,
      warn: false,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Content"
        description="Copy and credibility material the client owns and changes without a developer."
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card-interactive block p-6">
            <p className="text-xs uppercase tracking-widest text-chalk-faint">{c.title}</p>
            <p
              className={`mt-3 font-display text-4xl ${
                c.warn ? "text-gold" : "text-metal"
              }`}
            >
              {c.metric}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-chalk-ghost">
              {c.sub}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-chalk-muted">{c.blurb}</p>
          </Link>
        ))}
      </div>

      {/*
        The one standing warning on this screen. An unverified figure is an
        advertising claim nobody has checked, and the old site published two of
        them broken (".7Mil+" for subscribers, a bare "K" for Facebook).
      */}
      {statsUnverified > 0 && (
        <div className="mt-4 rounded-card border border-gold/30 bg-gold/5 p-5">
          <p className="text-sm leading-relaxed text-chalk-body">
            <span className="font-semibold text-gold">
              {statsUnverified} statistic{statsUnverified > 1 ? "s" : ""}
            </span>{" "}
            {statsUnverified > 1 ? "are" : "is"} held back from the public site because nobody
            has confirmed the number.{" "}
            <Link href="/admin/content/stats" className="text-gold underline underline-offset-4">
              Review them
            </Link>
            .
          </p>
        </div>
      )}

      <div className="mt-4 rounded-card border border-ink-line bg-ink-soft p-6">
        <p className="eyebrow">How this reaches the site</p>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-chalk-muted">
          <li>
            <span className="text-chalk">Saving publishes immediately.</span> There is no
            second approval step, so the public pages are rebuilt the moment a change is
            saved.
          </li>
          <li>
            <span className="text-chalk">Three switches decide what visitors see:</span>{" "}
            a sponsor&apos;s <em>Active</em>, a statistic&apos;s <em>Verified</em>, and a
            section&apos;s <em>Published</em>. Anything switched off is stored but never
            rendered.
          </li>
          <li>
            <span className="text-chalk">Every change is recorded</span> against the account
            that made it, including who marked a statistic verified.
          </li>
          <li>
            <span className="text-chalk">Deleting is owner-only.</span> Editors can switch
            anything off, which is reversible; removing the row is not.
          </li>
        </ul>
        <p className="mt-5 text-xs text-chalk-faint">
          Shows, episodes and winners are managed under{" "}
          <Link href="/admin/shows" className="text-chalk-muted underline underline-offset-4 hover:text-gold">
            Shows &amp; Events
          </Link>
          , not here.
        </p>
      </div>
    </>
  );
}
