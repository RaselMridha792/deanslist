import { Fragment } from "react";
import { Marquee } from "@/components/dl/Marquee";

/**
 * One of the only two places on the site where red is a full field. The other
 * is the closing poster. Everywhere else red is a chip, a rule or a word, and
 * that restraint is what stops the page looking like a sale banner.
 *
 * Separators are 6px squares, not bullets: the system has no round shapes.
 */
const ITEMS = [
  "Singers",
  "Rappers",
  "Musicians",
  "DJs",
  "Songwriters",
  "Perform from anywhere",
  "Voted live",
  "$1,000 prize",
];

function Run({ hidden = false }: { hidden?: boolean }) {
  return (
    <span aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-10 pr-10">
      {ITEMS.map((item) => (
        <Fragment key={item}>
          <span className="whitespace-nowrap">{item}</span>
          <span aria-hidden className="h-[6px] w-[6px] shrink-0 bg-current" />
        </Fragment>
      ))}
    </span>
  );
}

export function Ticker() {
  return (
    /*
      Marquee shifts one track width per cycle. A single run of this phrase list
      is roughly 1800px, so on a wider display the tail of the loop would show
      bare red. Two runs per track double the shift, and the duration doubles
      with them so the words keep the design's pace.
    */
    <Marquee className="border-y-2 border-ink bg-brand py-[14px] text-[clamp(16px,1.5vw,22px)] font-extrabold uppercase tracking-[.06em] text-white [&>div]:[animation-duration:56s]">
      <span className="flex shrink-0 items-center">
        <Run />
        <Run hidden />
      </span>
    </Marquee>
  );
}
