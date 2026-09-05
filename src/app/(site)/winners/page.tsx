import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/dl/Button";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { SectionHeading } from "@/components/dl/SectionHeading";
import { NEXT_WINNER_COPY } from "@/content/site";
import { getShows, getWinners, type Show, type Winner } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Past Winners",
  description:
    "Everyone who has taken the cash prize and a place on the Principal's Roll of the Dean's List.",
  alternates: { canonical: "/winners" },
};

// Winners and shows are dashboard-managed, so the archive is rendered per
// request rather than baked at build time.
export const dynamic = "force-dynamic";

/*
  /winners - the Principal's Roll.

  Design: designs/Winners.dc.html. Four bands: dark hero, the spotlight cell
  pair, the "Season by season" archive table, and the closing red poster.

  Every fact on the page is read from the data layer, because every one of them
  is the client's to edit: the spotlight is winners[0], the archive is the
  running shows followed by the winners, and the prize, show and date come off
  the row. The typed copy is the design's own: the hero lede and the poster
  headline are verbatim from Winners.dc.html, and the rest is the column words
  in the archive, the empty-state line and the client's NEXT_WINNER_COPY.
*/

/**
 * Two-column grids collapse to one at 900px per the handoff, so the variant is
 * min-[901px] rather than a Tailwind default breakpoint.
 */
const COL_7_5 =
  "grid items-end gap-[clamp(32px,5vw,96px)] min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]";

/* ------------------------------------------------------------------ dates */

/**
 * Dates print only when the database actually holds one. `announcedAt` is null
 * for both seeded winners because the old site contradicts itself about when
 * the challenge ran, and a guessed date on a winners page is a contest fact
 * invented out of thin air. An empty cell is the honest answer.
 *
 * Fixed to UTC so the server render and the crawler agree on the day.
 */
function formatDate(iso: string | null, month: "long" | "short"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month,
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Money never abbreviates: $1,000, never $1K. */
const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/* ------------------------------------------------------------ archive rows */

type ArchiveRow = {
  key: string;
  href: string;
  /**
   * The small red label at the head of the row. Derived from status, never a
   * season number: nothing in the data numbers the seasons, and both seeded
   * winners belong to the same show.
   */
  label: string;
  title: string;
  when: string;
  who: string;
  prize: string;
  action: string;
};

function buildRows(shows: Show[], winners: Winner[]): ArchiveRow[] {
  const running = shows
    .filter((s) => s.status === "LIVE" || s.status === "OPEN")
    .map<ArchiveRow>((s) => ({
      key: `show-${s.slug}`,
      href: `/shows/${s.slug}`,
      label: "Entries open",
      title: s.title,
      // Cadence when the show states one, otherwise its start date. Both come
      // off the row, and neither is filled in with a guess when both are absent.
      when: s.cadence ?? formatDate(s.startsAt, "short"),
      who: "In progress",
      // Null until the client confirms this season's pool. Left blank rather
      // than carried over from a previous season.
      prize: s.prizeAmount !== null ? `${money(s.prizeAmount)} pool` : "",
      action: "Enter",
    }));

  const past = winners.map<ArchiveRow>((w) => ({
    key: `winner-${w.slug}`,
    href: `/winners/${w.slug}`,
    label: "Past winner",
    title: w.showTitle ?? w.name,
    when: formatDate(w.announcedAt, "short"),
    who: w.name,
    prize: w.prizeAwarded !== null ? money(w.prizeAwarded) : "",
    action: "Story",
  }));

  return [...running, ...past];
}

/* -------------------------------------------------------------------- page */

export default async function WinnersPage() {
  const [winners, shows] = await Promise.all([getWinners(), getShows()]);

  const spotlight = winners[0] ?? null;
  const rows = buildRows(shows, winners);

  const spotlightDate = spotlight ? formatDate(spotlight.announcedAt, "long") : "";
  const spotlightKicker = [spotlight?.showTitle, spotlightDate].filter(Boolean).join(" / ");

  /**
   * The two fact cells under the spotlight. Built rather than hardcoded so a
   * fact the row does not carry is dropped instead of printed as a placeholder:
   * `prizeAwarded` is a real figure the client publishes, but it is theirs to
   * confirm per winner, and a prize cell reading "to follow" is worse than no
   * prize cell at all.
   */
  const spotlightFacts: { label: string; value: string; lead: boolean }[] = [];
  if (spotlight?.prizeAwarded != null) {
    spotlightFacts.push({ label: "Prize", value: money(spotlight.prizeAwarded), lead: true });
  }
  if (spotlight?.showTitle) {
    spotlightFacts.push({ label: "Show", value: spotlight.showTitle, lead: false });
  }

  /**
   * The one red mark in the spotlight cell. Declared once because it sits over
   * the gradient when there is a photograph and in the flow of the name plate
   * when there is not, and the two must not drift apart.
   */
  const winnerChip = (
    <span className="inline-flex bg-brand px-[14px] py-2 text-kicker font-semibold uppercase text-ground">
      Winner
    </span>
  );

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden bg-ink text-ground">
        <div className="absolute inset-0 -z-20 opacity-[.35]">
          <GrayscaleImage
            src="/media/gallery/cts-05"
            alt=""
            priority
            hover={false}
            sizes="100vw"
            className="h-full w-full"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink from-20% to-ink/40" />

        <div className="shell grid items-end gap-[clamp(32px,4vw,64px)] pb-[clamp(40px,5vw,72px)] pt-[clamp(56px,7vw,120px)] min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="animate-dl-rise">
            <Kicker onDark>Past challenges and winners</Kicker>
            <h1 className="mt-5 text-balance text-hero font-extrabold uppercase">
              The Principal&rsquo;s Roll.
            </h1>
          </div>

          {/* Verbatim from the design file, line 72. Not the longer contest
              blurb from the content module, which says nothing about what this
              page is. */}
          <p className="max-w-[44ch] animate-dl-rise text-pretty text-lede text-ground/85 [animation-delay:.2s]">
            Every completed challenge and the performer who took it. Managed from the dashboard, so
            the archive grows with every show.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- spotlight */}
      {spotlight && (
        <section className="shell pt-section">
          <div className="cells min-[901px]:grid-cols-2">
            <Reveal className="flex bg-ink">
              <Link
                href={`/winners/${spotlight.slug}`}
                className="group relative block aspect-[4/3] w-full overflow-hidden bg-ink text-ground"
              >
                {spotlight.photoUrl ? (
                  <>
                    <GrayscaleImage
                      src={spotlight.photoUrl}
                      alt={spotlight.name}
                      priority
                      sizes="(min-width: 901px) 50vw, 100vw"
                      className="h-full w-full"
                    />
                    {/* Red as a chip, which is all it ever is outside the poster. */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-[clamp(20px,3vw,40px)]">
                      {winnerChip}
                    </div>
                  </>
                ) : (
                  /*
                    The name plate, which is what this cell is when the row
                    carries no portrait.

                    No photograph of any winner exists, and the gallery frames
                    are of unidentified people, so one of them under a named
                    winner is not an option. Rather than apologise for the gap
                    with a placeholder, the cell keeps the design's geometry,
                    the 4/3 ink field, zero radius, the red chip in its own
                    corner, and fills it the way this system fills a poster:
                    with the name at display scale, over a 2px rule and a ground
                    of 2px hairlines. It is monochrome by construction, so the
                    grayscale rule holds with no image to filter.
                  */
                  <div
                    className="absolute inset-0 flex flex-col justify-between bg-ink p-[clamp(20px,3vw,40px)] transition-colors duration-200 ease-dl group-hover:bg-neutral-900"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(180deg,rgba(243,242,242,.07) 0 2px,transparent 2px 14px)",
                    }}
                  >
                    <div>
                      <p className="kicker-dark">Principal&rsquo;s Roll</p>
                      <div className="divider-dark mt-4" />
                    </div>

                    <div>
                      {/* Sized to break a long name across lines the way the
                          design stacks the homepage spotlight, and to stay
                          inside the 4/3 box at the narrowest column. */}
                      <p className="text-[clamp(28px,6vw,120px)] font-extrabold uppercase leading-[.9] tracking-[-.045em] [overflow-wrap:anywhere] min-[901px]:max-w-[9ch]">
                        {spotlight.name}
                      </p>
                      <div className="mt-6">{winnerChip}</div>
                    </div>
                  </div>
                )}
              </Link>
            </Reveal>

            <Reveal index={1} className="flex bg-ground">
              <div className="flex w-full flex-col justify-between gap-8 p-[clamp(28px,4vw,64px)]">
                <div>
                  {spotlightKicker && <Kicker>{spotlightKicker}</Kicker>}
                  <h2 className="mt-5 text-display-md font-extrabold">{spotlight.name}</h2>
                  {spotlight.story && (
                    <p className="mt-5 max-w-[44ch] text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] text-neutral-800">
                      {spotlight.story}
                    </p>
                  )}
                </div>

                <div className="divider grid grid-cols-2">
                  {spotlightFacts.map((fact, i) => (
                    <div
                      key={fact.label}
                      className={
                        i === 0
                          ? spotlightFacts.length > 1
                            ? "border-r-2 border-rule py-5 pr-5"
                            : "py-5 pr-5"
                          : "py-5 pl-5"
                      }
                    >
                      <p className="text-kicker font-semibold uppercase text-neutral-600">
                        {fact.label}
                      </p>
                      <p
                        className={
                          fact.lead
                            ? "mt-[6px] text-display-sm font-extrabold"
                            : "mt-[6px] text-[clamp(18px,1.4vw,24px)] font-extrabold leading-[1.1] tracking-[-.02em]"
                        }
                      >
                        {fact.value}
                      </p>
                    </div>
                  ))}

                  <div className="col-span-2 pt-2">
                    <ButtonLink
                      href={`/winners/${spotlight.slug}`}
                      size="lg"
                      className="min-h-[44px]"
                    >
                      Read the story
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- archive */}
      <section className="shell pt-section">
        {/* Sentence case, unlike every other heading on the site: the design
            sets this one without a text-transform. */}
        <SectionHeading
          kicker="All challenges"
          title={<span className="normal-case">Season by season.</span>}
        />

        {rows.length === 0 ? (
          <Reveal>
            <p className="py-6 text-lede text-neutral-700">
              The first winner will be announced at the end of the current season.
            </p>
          </Reveal>
        ) : (
          <div>
            {rows.map((row, i) => (
              <Reveal key={row.key} index={i}>
                {/*
                  Six columns on the wide layout, two on a phone. The row itself
                  is the tap target at 48px tall, not the chip at the end of it.
                */}
                <Link
                  href={row.href}
                  className="grid grid-cols-2 items-center gap-4 border-b-2 border-rule py-6 transition-colors duration-200 ease-dl hover:bg-surface min-[901px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <span className="col-span-2 text-eyebrow font-semibold uppercase text-brand-onLight min-[901px]:col-span-1">
                    {row.label}
                  </span>
                  <span className="col-span-2 text-[clamp(18px,1.6vw,26px)] font-extrabold tracking-[-.02em] min-[901px]:col-span-1">
                    {row.title}
                  </span>
                  <span className="text-sm text-neutral-700">{row.when}</span>
                  <span className="text-sm">{row.who}</span>
                  <span className="text-base font-extrabold">{row.prize}</span>
                  <span className="justify-self-end border-2 border-rule px-[14px] py-2 text-eyebrow font-semibold uppercase min-[901px]:justify-self-start">
                    {row.action}
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- cta */}
      {/* Red as a full field. It happens exactly twice on this site, and the
          closing poster is one of them. */}
      <section className="mt-section-lg bg-brand text-ground">
        <div className={`shell py-section ${COL_7_5}`}>
          <Reveal>
            {/* Verbatim from the design file, line 85. The content module's
                longer heading wraps to three or four lines at this size and
                the poster stops being a poster. */}
            <h2 className="text-[clamp(48px,7.5vw,140px)] font-extrabold uppercase leading-[.88] tracking-[-.05em]">
              Your stage awaits.
            </h2>
          </Reveal>

          <Reveal index={1} className="flex flex-col gap-6 border-t-2 border-ground pt-6">
            {NEXT_WINNER_COPY.body.map((para) => (
              <p
                key={para.slice(0, 40)}
                className="text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] text-ground/90"
              >
                {para}
              </p>
            ))}

            {/* Black on red. None of the four button variants carries that
                pairing, so the fill is set from tokens on the outlined one
                rather than added as a one-off to the CSS. */}
            <ButtonLink
              href="/enter"
              variant="outline"
              size="lg"
              className="min-h-[44px] w-full border-ink bg-ink text-ground hover:border-neutral-900 hover:bg-neutral-900 hover:text-ground"
            >
              Enter the contest
            </ButtonLink>
          </Reveal>
        </div>
      </section>
    </>
  );
}
