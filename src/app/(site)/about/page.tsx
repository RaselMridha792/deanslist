import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/dl/Button";
import { Cell, CellGrid } from "@/components/dl/CellGrid";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { cn } from "@/lib/cn";
import { formatStat, getCurrentShow, getLatestWinner, getStats } from "@/lib/queries";

export const metadata: Metadata = {
  title: "What is the Dean's List",
  description:
    "A platform built to celebrate excellence and showcase worldwide talent. Perform, get voted on, win the prize, and take a place on the Principal's Roll.",
};

// Show, winner and stats are dashboard-managed, so this renders per request
// rather than being baked at build time.
export const dynamic = "force-dynamic";

/**
 * /about: "What is the Dean's List".
 *
 * Design: designs/About.dc.html. Five bands: dark hero, the platform (heading
 * plus one paragraph, then four cells), the Principal's Roll panel against a
 * photograph, a stats row, and the closing red poster.
 *
 * Three things are deliberately read from the data layer rather than typed in,
 * because each is a contest fact the client owns and edits:
 *
 *   the winner and show named in the Principal's Roll paragraph. site.ts
 *     records that the old site names two different winners for the same
 *     challenge, so hardcoding one here would publish an unconfirmed name
 *   the prize sentence in cell 03. The current show's prize pool is still
 *     unconfirmed (SHOWS.pending), so the sentence appears only once a figure
 *     exists rather than asserting $1,000 of a show that has not announced one
 *   the stats row. getStats() returns verified figures only. The design shows
 *     "700K+ YouTube subscribers"; that figure is flagged unverified (and the
 *     old site publishes 1.7M for the same thing), so its cell stays out until
 *     someone confirms it in the dashboard.
 */
export default async function AboutPage() {
  const [show, winner, stats] = await Promise.all([
    getCurrentShow(),
    getLatestWinner(),
    getStats(),
  ]);

  /* ------------------------------------------------ 01 / The platform */

  /*
   * The design's paragraph, verbatim except for one excision. It reads
   * "an audience of over 700,000 subscribers votes live"; that subscriber
   * figure is stored verified:false and withheld from the public site, and the
   * client's live site publishes 1.7 million for the same metric. Three
   * sources, three answers, so the words "of over 700,000 subscribers" are
   * held back and the rest of the sentence stands. Put them back the moment
   * the client confirms a figure.
   */
  const platformBody =
    "Dean's List LTD produces global music and talent contests such as Crown the Sound and Drop That Mike. Contestants submit performances from wherever they are, an audience votes live, and winners are rewarded with cash prizes and a place on the Principal's Roll.";

  const prizeBody = [
    "Cash prizes, awarded per challenge.",
    show?.prizeAmount
      ? `The current show carries a $${show.prizeAmount.toLocaleString("en-US")} pool.`
      : null,
  ]
    .filter((s): s is string => Boolean(s))
    .join(" ");

  const platform = [
    {
      n: "01",
      title: "The format",
      body: "Each show is a challenge with a deadline. Entries are video performances, reviewed by the team and put to the audience.",
    },
    {
      n: "02",
      title: "The vote",
      body: "Every round is decided live across YouTube and Facebook. On Drop That Mike the audience controls the prize pool with Freeze or Pass.",
    },
    { n: "03", title: "The prize", body: prizeBody },
    {
      n: "04",
      title: "The Roll",
      body: "Winners take a permanent place on the Principal's Roll of the Dean's List, the honours list of the platform.",
    },
  ];

  /* ---------------------------------------- 02 / The Principal's Roll */

  const roll = ["The Roll is the record of every Dean's List winner."];
  if (winner?.showTitle) roll.push(`${winner.name} joined it after ${winner.showTitle}.`);
  if (show) roll.push(`${show.title} adds the next name.`);

  /* --------------------------------------------------------- the stats */

  // The design's third cell reads "Live, every week / Tuesday". The word comes
  // from the show's own cadence so the dashboard owns it; "Every Tuesday" is
  // the same fallback the Countdown primitive already assumes, and it is the
  // one thing the old site is consistent about.
  const cadence = (show?.cadence ?? "Every Tuesday").replace(/^every\s+/i, "");

  const statCells = [
    ...stats.map((s) => ({ key: s.key, label: s.label, value: formatStat(s) })),
    { key: "cadence", label: "Live, every week", value: cadence },
  ];

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden bg-ink text-ground">
        <div className="absolute inset-0 -z-20 opacity-[.35]">
          <GrayscaleImage
            src="/media/gallery/cts-03"
            alt=""
            priority
            hover={false}
            sizes="100vw"
            className="h-full w-full"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink from-20% to-ink/40" />

        <div className="shell grid items-end gap-[clamp(32px,4vw,64px)] pb-[clamp(40px,5vw,72px)] pt-[clamp(56px,7vw,120px)] min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="animate-dl-rise">
            <Kicker onDark>What is the Dean&apos;s List</Kicker>
            <h1 className="mt-5 text-balance text-hero font-extrabold uppercase">
              The list every performer wants to be on.
            </h1>
          </div>

          <p className="max-w-[44ch] animate-dl-rise text-pretty text-lede text-ground/85 [animation-delay:.2s]">
            A global online talent competition, broadcast and voted on across YouTube and Facebook.
            No travel, no venue, no gatekeeping. Just the performance.
          </p>
        </div>
      </section>

      {/* -------------------------------------------- 01 / The platform */}
      <section className="shell pt-section">
        {/*
          Sentence case, not the uppercase SectionHeading: the design reserves
          uppercase display type for the hero and the closing poster. Both
          columns sit on the same baseline, as the design has them.
        */}
        <div className="grid items-end gap-8 pb-[clamp(24px,3vw,40px)] min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:gap-[clamp(32px,5vw,96px)]">
          <Reveal>
            <Kicker>01 / The platform</Kicker>
            <h2 className="mt-5 text-balance text-display-md font-extrabold">
              Built for the performer who has the talent but not the stage.
            </h2>
          </Reveal>

          <Reveal index={1}>
            <p className="max-w-[52ch] text-pretty text-lede text-neutral-800">{platformBody}</p>
          </Reveal>
        </div>

        <CellGrid cols={4} className="border-y-2 border-rule">
          {platform.map((c, i) => (
            <Cell
              key={c.n}
              index={i}
              className={cn(
                "flex min-h-[260px] flex-col gap-[18px] py-[clamp(28px,3vw,48px)]",
                // The first cell sits flush with the gutter, so its number lines
                // up with the heading above it rather than sitting 32px inside.
                i === 0 && "lg:pl-0",
              )}
            >
              <p className="text-[14px] font-extrabold tracking-[.1em] text-brand">{c.n}</p>
              <h3 className="text-[clamp(24px,2.2vw,36px)] font-extrabold leading-none tracking-[-.03em]">
                {c.title}
              </h3>
              <p className="mt-auto text-pretty text-body text-neutral-700">{c.body}</p>
            </Cell>
          ))}
        </CellGrid>
      </section>

      {/* --------------------------------- 02 / The Principal's Roll */}
      <section className="shell pt-section">
        <div className="grid gap-[2px] bg-rule min-[900px]:grid-cols-2">
          <Reveal>
            <GrayscaleImage
              src="/media/gallery/cts-07"
              alt="On stage under the lights"
              ratio="4/3"
              hover={false}
              sizes="(min-width: 900px) 50vw, 100vw"
              className="h-full"
            />
          </Reveal>

          <Reveal
            index={1}
            className="flex flex-col justify-between gap-8 bg-ink p-[clamp(28px,4vw,64px)] text-ground"
          >
            <div>
              <Kicker onDark>02 / The Principal&apos;s Roll</Kicker>
              <h2 className="mt-5 text-balance text-[clamp(32px,3.6vw,64px)] font-extrabold leading-[.95] tracking-[-.04em]">
                One name at a time.
              </h2>
            </div>

            <p className="text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] text-ground/85">
              {roll.join(" ")}
            </p>

            <div>
              <ButtonLink href="/winners" variant="outline-dark" size="lg">
                See the winners
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- stats */}
      <section className="shell pt-section">
        <CellGrid
          cols={statCells.length >= 3 ? 3 : 2}
          className="border-y-2 border-rule"
        >
          {statCells.map((s, i) => (
            <Cell
              key={s.key}
              index={i}
              className={cn("py-[clamp(32px,4vw,56px)]", i === 0 && "lg:pl-0")}
            >
              <Kicker>{s.label}</Kicker>
              <p className="mt-[18px] text-stat font-extrabold">{s.value}</p>
            </Cell>
          ))}
        </CellGrid>
      </section>

      {/* ---------------------------------------------- closing poster */}
      {/* Red as a full field. The only place on this page it is allowed to be. */}
      <section className="mt-section-lg bg-brand text-ground">
        <div className="shell grid items-end gap-[clamp(32px,5vw,96px)] py-section min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Reveal>
            <h2 className="text-[clamp(48px,7.5vw,140px)] font-extrabold uppercase leading-[.88] tracking-[-.05em]">
              Your stage awaits.
            </h2>
          </Reveal>

          <Reveal index={1} className="flex flex-col gap-6 border-t-2 border-ground pt-6">
            <p className="text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] text-ground/90">
              Entries are open. Four fields and one minute stand between you and the Principal&apos;s
              Roll.
            </p>
            {/*
              A black button on the red field. Not a Button variant: the four in
              the system are red, outlined light, outlined dark and ghost, and
              none of them is a solid ink fill. The .btn class still carries the
              flush-left label and the zero radius.
            */}
            <Link
              href="/enter"
              className="btn btn-lg w-full border-ink bg-ink text-ground hover:border-neutral-900 hover:bg-neutral-900"
            >
              Enter the contest
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
