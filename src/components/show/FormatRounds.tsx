import { Reveal } from "@/components/dl/Reveal";
import type { Round } from "@/content/site";

/**
 * A show's format, round by round, as the client's rules sheet lays it out:
 * the round number, its stage, a title, the rules in prose, and the short terms
 * the sheet prints underneath.
 *
 * Used on the show page and on /rules from the same data (src/content/site.ts),
 * so the two can never describe different games.
 *
 * The sheet itself colours each round differently. The site keeps its own
 * palette instead: red is spent on the round numbers, everything else stays
 * ink on ground, the same as every other cell grid on the site.
 */
export function FormatRounds({ rounds }: { rounds: Round[] }) {
  if (rounds.length === 0) return null;

  return (
    <ol className="grid list-none gap-[2px] border-y-2 border-rule bg-rule p-0 min-[900px]:grid-cols-3">
      {rounds.map((r, i) => (
        <li key={r.number} className="bg-ground">
          <Reveal
            index={i}
            className="flex h-full flex-col gap-5 p-[clamp(24px,3vw,44px)]"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-[clamp(44px,5vw,72px)] font-extrabold leading-none tracking-[-.05em] text-brand">
                {r.number}
              </span>
              <span className="text-kicker font-semibold uppercase text-neutral-600">
                {r.stage}
              </span>
            </div>

            <h3 className="text-balance text-display-sm font-extrabold uppercase">
              {r.title}
            </h3>

            <div className="flex flex-col gap-3">
              {r.body.map((p) => (
                <p
                  key={p.slice(0, 40)}
                  className="text-pretty text-[16px] leading-[1.55] text-neutral-800"
                >
                  {p}
                </p>
              ))}
            </div>

            <ul className="mt-auto flex list-none flex-wrap gap-2 p-0 pt-2">
              {r.terms.map((t) => (
                <li
                  key={t}
                  className="border-2 border-ink px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[.08em]"
                >
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
