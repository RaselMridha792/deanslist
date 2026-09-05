import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/dl/Button";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { getShows, type Show } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Shows and events",
  description:
    "Every Dean's List show and challenge, and the one taking entries right now.",
  alternates: { canonical: "/shows" },
};

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  LIVE: "Live now",
  OPEN: "Entries open",
  CLOSED: "Season closed",
  ARCHIVED: "Archived",
};

/*
  Copy that exists only in the design language, not in the data layer. No dates,
  no prize figures, no audience numbers: everything factual on this page is read
  from the show rows so the dashboard stays the single source of truth.
*/
const COPY = {
  heroKicker: "Shows and events",
  heroTitle: "Every stage we run.",
  heroLede: "One platform, every stage. Enter whichever show fits your talent.",
  openKicker: "01 / Taking entries",
  openTitle: "Open right now.",
  allKicker: "02 / The full list",
  allTitle: "The full list.",
  ctaTitle: "Your stage awaits.",
  ctaBody:
    "Entries are open. Four fields and one minute stand between you and the Principal's Roll.",
  tba: "To be announced",
} as const;

function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

function isOpen(s: Show): boolean {
  return s.status === "OPEN" || s.status === "LIVE";
}

export default async function ShowsPage() {
  const shows = await getShows();
  const open = shows.filter(isOpen);
  const featured = open[0] ?? shows[0] ?? null;
  const anyOpen = open.length > 0;

  return (
    <>
      {/* ------------------------------------------------------------ hero */}

      <section className="relative isolate overflow-hidden bg-ink text-ground">
        {featured?.keyArt && (
          <div className="absolute inset-0 -z-20 opacity-[.35]">
            <GrayscaleImage
              src={featured.keyArt}
              alt=""
              priority
              hover={false}
              sizes="100vw"
              className="h-full w-full"
            />
          </div>
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink from-20% to-ink/40" />

        <div className="mx-auto grid max-w-shell gap-8 px-gutter pb-[clamp(40px,5vw,72px)] pt-section min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[900px]:items-end min-[900px]:gap-[clamp(32px,4vw,64px)]">
          <div className="animate-dl-rise">
            <Kicker onDark>{COPY.heroKicker}</Kicker>
            <h1 className="mt-5 text-balance font-extrabold uppercase text-hero">
              {COPY.heroTitle}
            </h1>
          </div>
          <p className="max-w-[44ch] animate-dl-rise text-pretty text-lede opacity-85 [animation-delay:.2s]">
            {COPY.heroLede}
          </p>
        </div>
      </section>

      {/* --------------------------------------------- 01 / Taking entries */}

      {anyOpen && (
        <section className="mx-auto max-w-shell px-gutter pt-section">
          <div className="grid gap-8 pb-[clamp(24px,3vw,40px)] min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:items-end min-[900px]:gap-[clamp(32px,5vw,96px)]">
            <Reveal>
              <Kicker>{COPY.openKicker}</Kicker>
              <h2 className="mt-5 text-balance font-extrabold text-display-md">
                {COPY.openTitle}
              </h2>
            </Reveal>
          </div>

          <div className="grid gap-[2px] bg-rule">
            {open.map((show) => (
              <ShowFeature key={show.slug} show={show} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------- 02 / The full list */}

      <section className="mx-auto max-w-shell px-gutter pt-section">
        <div className="grid gap-8 pb-[clamp(24px,3vw,40px)] min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:items-end min-[900px]:gap-[clamp(32px,5vw,96px)]">
          <Reveal>
            <Kicker>{COPY.allKicker}</Kicker>
            <h2 className="mt-5 text-balance font-extrabold text-display-md">{COPY.allTitle}</h2>
          </Reveal>
        </div>

        <div className="border-t-2 border-rule">
          {shows.map((show, i) => (
            <ShowRow key={show.slug} show={show} index={i} />
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- closing poster */}

      <section className="mt-section-lg bg-brand text-ground">
        <div className="mx-auto grid max-w-shell gap-8 px-gutter py-section min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[900px]:items-end min-[900px]:gap-[clamp(32px,5vw,96px)]">
          <Reveal>
            <h2 className="font-extrabold uppercase text-display-xl">{COPY.ctaTitle}</h2>
          </Reveal>
          <Reveal index={1} className="flex flex-col gap-6 border-t-2 border-ground pt-6">
            <p className="text-pretty text-lede opacity-90">{COPY.ctaBody}</p>
            <ButtonLink
              href="/enter"
              variant="outline"
              size="lg"
              className="w-full border-ink bg-ink text-ground hover:border-neutral-900 hover:bg-neutral-900 hover:text-ground"
            >
              Enter the contest
            </ButtonLink>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/**
 * The show that is taking entries, given the spotlight treatment: grayscale key
 * art in one cell, the show in the other, separated by the same 2px rule the
 * rest of the system uses.
 */
function ShowFeature({ show }: { show: Show }) {
  const href = `/shows/${show.slug}`;

  return (
    <div className="grid gap-[2px] bg-rule min-[900px]:grid-cols-2">
      <Reveal className="bg-ink">
        <Link href={href} className="group relative block" tabIndex={-1} aria-hidden>
          {show.keyArt ? (
            <GrayscaleImage
              src={show.keyArt}
              alt=""
              ratio="4/3"
              sizes="(min-width: 900px) 50vw, 100vw"
            />
          ) : (
            <div className="aspect-[4/3] w-full bg-ink" />
          )}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-[clamp(20px,3vw,40px)]">
            <span className="inline-flex bg-brand px-[14px] py-2 text-kicker font-semibold uppercase text-white">
              {STATUS_LABEL[show.status] ?? show.status}
            </span>
          </span>
        </Link>
      </Reveal>

      <Reveal
        index={1}
        className="flex flex-col justify-between gap-8 bg-ground p-[clamp(28px,4vw,64px)]"
      >
        <div>
          {show.cadence && <Kicker>{show.cadence}</Kicker>}
          <h3 className="mt-5 font-extrabold text-display-md">
            <Link href={href} className="hover:text-brand-onLight">
              {show.title}
            </Link>
          </h3>
          {show.tagline && (
            <p className="mt-5 max-w-[44ch] text-pretty text-lede text-neutral-800">
              {show.tagline}
            </p>
          )}
        </div>

        <div>
          <dl className="grid grid-cols-2 border-t-2 border-rule">
            <div className="border-r-2 border-rule py-5 pr-5">
              <dt className="text-kicker font-semibold uppercase text-neutral-600">Prize</dt>
              {/* Printed only once the client has confirmed a figure. */}
              <dd className="mt-2 font-extrabold text-display-sm">
                {show.prizeAmount ? money(show.prizeAmount) : COPY.tba}
              </dd>
            </div>
            <div className="py-5 pl-5">
              <dt className="text-kicker font-semibold uppercase text-neutral-600">When</dt>
              <dd className="mt-2 font-extrabold text-display-sm">{show.cadence ?? COPY.tba}</dd>
            </div>
          </dl>

          <ButtonLink href={`/enter?show=${show.slug}`} size="lg" className="mt-6 w-full">
            Enter this show
          </ButtonLink>
        </div>
      </Reveal>
    </div>
  );
}

/**
 * One archive row. The whole row is the link, so the tap target is the full
 * width of the list rather than the small chip at the end of it.
 */
function ShowRow({ show, index }: { show: Show; index: number }) {
  const label = STATUS_LABEL[show.status] ?? show.status;

  return (
    <Reveal index={index}>
      <Link
        href={`/shows/${show.slug}`}
        className="grid items-center gap-4 border-b-2 border-rule py-6 transition-colors duration-200 ease-dl hover:bg-surface min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <span className="text-eyebrow font-semibold uppercase text-brand-onLight">{label}</span>
        <span className="font-extrabold tracking-[-.02em] text-[clamp(18px,1.6vw,26px)] leading-none">
          {show.title}
        </span>
        <span className="text-sm text-neutral-700">{show.cadence ?? COPY.tba}</span>
        <span className="text-sm">{show.tagline ?? ""}</span>
        <span className="font-extrabold">
          {show.prizeAmount ? `${money(show.prizeAmount)} pool` : ""}
        </span>
        <span className="justify-self-start border-2 border-rule px-[14px] py-2 text-eyebrow font-semibold uppercase min-[900px]:justify-self-end">
          {isOpen(show) ? "Enter" : "View"}
        </span>
      </Link>
    </Reveal>
  );
}
