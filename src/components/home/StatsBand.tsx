import { formatStat, type Stat } from "@/lib/queries";

/**
 * The old site's counter renders ".7Mil+" for subscribers and a bare "K" for
 * Facebook followers, because it animates from an empty value and only the
 * suffix survives. It is the most visible defect on the site.
 *
 * The correction is structural, not cosmetic: getStats() only ever returns
 * figures marked verified, and this renders nothing at all when there are none.
 * An absent band beats a broken number.
 */
export function StatsBand({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;

  return (
    <section className="border-b border-ink-line bg-ink-raised">
      <div className="shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.key}>
            <p className="font-display text-5xl leading-none text-metal">{formatStat(s)}</p>
            <p className="mt-2 text-eyebrow uppercase text-chalk-faint">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
