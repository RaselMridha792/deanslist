import { CountUp } from "@/components/dl/CountUp";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { cn } from "@/lib/cn";
import { formatStat, type Stat } from "@/lib/queries";

/**
 * The band the design draws with four cells. It renders however many the client
 * has actually confirmed, and nothing at all when that is none.
 *
 * That is not defensive coding for its own sake: getStats() returns only rows
 * marked verified, and today the subscriber and follower counts are not. The
 * old site's counter animates from an empty value and publishes ".7Mil+" to the
 * world, so an absent band is the deliberate correction, not a gap.
 */
export function StatsBand({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;

  return (
    <section className="mx-auto max-w-shell px-gutter">
      {/*
        Columns follow the count, not the design's four.

        bg-rule shows through a 2px gap to draw the separators, so a fixed
        four-column grid with one confirmed stat paints three empty columns in
        rgba(32,30,29,.4) — a dark hole across three quarters of the band. The
        band is correct at any count this way, and becomes the design's four the
        moment the client verifies the remaining figures.
      */}
      <div
        className={cn(
          "grid gap-[2px] border-b-2 border-rule bg-rule",
          stats.length >= 4
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : stats.length === 3
              ? "sm:grid-cols-3"
              : stats.length === 2
                ? "sm:grid-cols-2"
                : "grid-cols-1",
        )}
      >
        {stats.map((stat, i) => (
          <Reveal
            key={stat.key}
            index={i}
            className={cn(
              "bg-ground px-[clamp(16px,2vw,32px)] py-[clamp(32px,4vw,56px)]",
              i === 0 && "pl-0",
              i === stats.length - 1 && "pr-0",
            )}
          >
            <Kicker className="mb-[18px]">{stat.label}</Kicker>
            <p className="text-stat font-extrabold">
              {/*
                Counts animate; abbreviated figures do not. CountUp rounds to a
                whole number, so "1.7M" would tick up to "2M" halfway and land
                wrong. Anything the formatter abbreviates is printed static.
              */}
              {!stat.prefix && stat.value >= 10_000 ? (
                formatStat(stat)
              ) : (
                <CountUp value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              )}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
