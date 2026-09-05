import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/dl/Button";
import { Cell, CellGrid } from "@/components/dl/CellGrid";
import { Countdown } from "@/components/dl/Countdown";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { env } from "@/lib/env";
import { getEpisodes, getShow } from "@/lib/queries";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  jsonLdScriptProps,
  showEventJsonLd,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/*
  Copy that exists only in the design file, kept verbatim. It lives in constants
  rather than inline JSX so an apostrophe stays an apostrophe and nobody has to
  decide how to escape it in three different places.
*/
const COPY = {
  whenBody:
    "Broadcast on the Dean's List YouTube channel and Facebook page. Show dates are announced first to the mailing list.",
  whereTitle: "From home",
  whereBody:
    "You perform where you are. Submit a public performance video link with your entry.",
  whoTitle: "Every talent",
  whoBody:
    "Singers, songwriters, musicians, DJs, rappers and more. Open worldwide, subject to eligibility.",
  prizeFallback: "Cash, awarded live at the end of the show. Full terms on the rules page.",
  promoTitle: "See how it plays.",
  ctaTitle: "Your stage awaits.",
  ctaOpen:
    "Entries are open. Four fields and one minute stand between you and the Principal's Roll.",
  ctaClosed:
    "Entries are not open for this show. Register your interest and you will hear first when they are.",
  tba: "To be announced",
} as const;

/**
 * First sentence, then the rest, and only when the split is worth making.
 *
 * The design sets the opening line of the show's own description as the display
 * headline and the remainder as the body paragraph, and does the same inside the
 * Freeze and Pass cells. Doing that here rather than hardcoding Drop That Mike's
 * words is what keeps this file a template: /shows/crown-the-sound must not
 * inherit a Freeze or Pass claim that is not true of it.
 */
function splitLead(text: string | null | undefined): [string, string] | null {
  if (!text) return null;
  const m = text.match(/^(.{12,90}?[.!?])\s+(\S[\s\S]*)$/);
  return m ? [m[1], m[2]] : null;
}

/** "Every Tuesday" reads as "every Tuesday" once it is inside a sentence. */
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/** The design sets the show name as a sentence. Never two full stops. */
function asSentence(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const show = await getShow(slug);
  if (!show) return { title: "Show not found" };

  return {
    title: show.title,
    description: show.tagline ?? show.description ?? undefined,
    alternates: { canonical: `/shows/${show.slug}` },
    openGraph: {
      title: show.title,
      description: show.tagline ?? undefined,
      url: `${env.NEXT_PUBLIC_SITE_URL}/shows/${show.slug}`,
    },
  };
}

export default async function ShowPage({ params }: Params) {
  const { slug } = await params;
  const show = await getShow(slug);
  if (!show) notFound();

  const episodes = await getEpisodes(slug);
  const promo = episodes[0] ?? null;
  const takingEntries = show.status === "OPEN" || show.status === "LIVE";
  const enterHref = takingEntries ? `/enter?show=${show.slug}` : "/enter";

  // showEventJsonLd returns null when the show has no confirmed startDate —
  // Event markup without one is invalid and Google penalises it, and inventing
  // a date to satisfy a schema would be worse than shipping no schema.
  const jsonLd = jsonLdGraph(
    showEventJsonLd(show),
    breadcrumbJsonLd([
      { name: "Shows", path: "/shows" },
      { name: show.title, path: `/shows/${show.slug}` },
    ]),
  );

  /* ------------------------------------------------ 01 / The format */

  const split = splitLead(show.description);
  const formatTitle = split?.[0] ?? show.tagline ?? asSentence(show.title);
  const formatBody = split?.[1] ?? show.description ?? null;

  /* --------------------------------------- 02 / Schedule and prize */

  const scheduleTitle =
    [
      show.cadence ? asSentence(show.cadence) : null,
      show.prizeAmount ? `${money(show.prizeAmount)} on the line.` : null,
    ]
      .filter(Boolean)
      .join(" ") || "When it runs, and what is on the line.";

  const mechanic = show.mechanic ?? [];
  const prizeBody =
    mechanic.length >= 2
      ? `Cash, controlled live by the audience with ${mechanic[0].name} or ${mechanic[1].name}. Full terms on the rules page.`
      : COPY.prizeFallback;

  /* -------------------------------------------------------- hero lede */

  const lede = [
    show.tagline,
    show.cadence ? `Live ${lowerFirst(show.cadence)} on YouTube and Facebook.` : null,
    takingEntries ? "Entries are open now." : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {jsonLd && <script {...jsonLdScriptProps(jsonLd)} />}

      {/* ------------------------------------------------------------ hero */}

      <section className="relative isolate overflow-hidden bg-ink text-ground">
        {show.keyArt && (
          <div className="absolute inset-0 -z-20 opacity-[.35]">
            <GrayscaleImage
              src={show.keyArt}
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
            <Kicker onDark>Current show</Kicker>
            <h1 className="mt-5 text-balance font-extrabold uppercase text-hero">
              {asSentence(show.title)}
            </h1>
          </div>
          {lede && (
            <p className="max-w-[44ch] animate-dl-rise text-pretty text-lede opacity-85 [animation-delay:.2s]">
              {lede}
            </p>
          )}
        </div>
      </section>

      {/* -------------------------------------------------- countdown bar */}

      {/*
        Only while the show is actually taking entries. A countdown on a closed
        season would be counting to nothing, and the fallback target (the show's
        own stated Tuesday cadence) would read as a promise nobody made.
      */}
      {takingEntries ? (
        <section className="bg-ink text-ground">
          <div className="mx-auto grid max-w-shell gap-6 px-gutter pb-[clamp(32px,4vw,56px)] min-[900px]:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] min-[900px]:items-end min-[900px]:gap-[clamp(12px,2vw,24px)]">
            <Countdown target={show.startsAt} onDark className="!max-w-none" />
            <ButtonLink href={enterHref} size="lg" className="w-full">
              Enter this show
            </ButtonLink>
          </div>
        </section>
      ) : (
        <section className="bg-ink text-ground">
          <div className="mx-auto flex max-w-shell flex-wrap items-center gap-6 border-t-2 border-rule-dark px-gutter py-6">
            <span className="kicker-dark">Season closed</span>
            <ButtonLink href="/shows" variant="outline-dark">
              All shows
            </ButtonLink>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ 01 / The format */}

      <section className="mx-auto max-w-shell px-gutter pt-section">
        <div className="grid gap-8 pb-[clamp(24px,3vw,40px)] min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:items-end min-[900px]:gap-[clamp(32px,5vw,96px)]">
          <Reveal>
            <Kicker>01 / The format</Kicker>
            <h2 className="mt-5 text-balance font-extrabold text-display-md">{formatTitle}</h2>
          </Reveal>
          <Reveal index={1} className="space-y-5">
            {formatBody && (
              <p className="max-w-[52ch] text-pretty text-lede text-neutral-800">{formatBody}</p>
            )}
            {/* The client's own words about their own format, kept verbatim. */}
            {show.pitch?.map((line) => (
              <p key={line.slice(0, 40)} className="max-w-[52ch] text-pretty text-neutral-700">
                {line}
              </p>
            ))}
          </Reveal>
        </div>

        {/*
          Freeze and Pass. The first cell is a full red field, which the design
          spends here and once more on the closing poster and nowhere else.
        */}
        {mechanic.length > 0 && (
          <div className="grid gap-[2px] bg-rule min-[900px]:grid-cols-2">
            {mechanic.map((m, i) => {
              const parts = splitLead(m.body);
              const headline = parts?.[0] ?? m.name;
              const body = parts?.[1] ?? m.body;
              const red = i === 0;

              return (
                <Reveal
                  key={m.name}
                  index={i}
                  className={
                    red
                      ? "flex min-h-[360px] flex-col justify-between gap-6 bg-brand p-[clamp(28px,4vw,64px)] text-ground"
                      : "flex min-h-[360px] flex-col justify-between gap-6 bg-ink p-[clamp(28px,4vw,64px)] text-ground"
                  }
                >
                  {parts && (
                    <p
                      className={
                        red
                          ? "text-kicker font-semibold uppercase opacity-85"
                          : "text-kicker font-semibold uppercase opacity-60"
                      }
                    >
                      {m.name}
                    </p>
                  )}
                  <p
                    className={
                      red
                        ? "text-balance font-extrabold uppercase text-display-md"
                        : "text-balance font-extrabold uppercase text-display-md opacity-90"
                    }
                  >
                    {headline}
                  </p>
                  <p
                    className={
                      red
                        ? "max-w-[40ch] text-pretty text-lede"
                        : "max-w-[40ch] text-pretty text-lede opacity-80"
                    }
                  >
                    {body}
                  </p>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>

      {/* --------------------------------------- 02 / Schedule and prize */}

      <section className="mx-auto max-w-shell px-gutter pt-section">
        <div className="grid gap-8 pb-[clamp(24px,3vw,40px)] min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:items-end min-[900px]:gap-[clamp(32px,5vw,96px)]">
          <Reveal>
            <Kicker>02 / Schedule and prize</Kicker>
            <h2 className="mt-5 text-balance font-extrabold text-display-md">{scheduleTitle}</h2>
          </Reveal>
          <Reveal index={1}>
            {/*
              The design leaves this column empty. It is the right place for the
              facts the client has not confirmed: naming the gap is honest, and
              far better than printing a guessed date or prize next to it.
            */}
            {show.pending && show.pending.length > 0 && (
              <p className="max-w-[52ch] text-pretty text-neutral-700">
                Still to be announced: {show.pending.join(", ").toLowerCase()}.
              </p>
            )}
          </Reveal>
        </div>

        <CellGrid cols={4} className="border-y-2 border-rule">
          <Cell index={0} className="flex min-h-[260px] flex-col gap-[18px]">
            <p className="text-sm font-extrabold tracking-[.1em] text-brand">When</p>
            <h3 className="font-extrabold text-display-sm">{show.cadence ?? COPY.tba}</h3>
            <p className="mt-auto text-pretty text-neutral-700">{COPY.whenBody}</p>
          </Cell>

          <Cell index={1} className="flex min-h-[260px] flex-col gap-[18px]">
            <p className="text-sm font-extrabold tracking-[.1em] text-brand">Where</p>
            <h3 className="font-extrabold text-display-sm">{COPY.whereTitle}</h3>
            <p className="mt-auto text-pretty text-neutral-700">{COPY.whereBody}</p>
          </Cell>

          <Cell index={2} className="flex min-h-[260px] flex-col gap-[18px]">
            <p className="text-sm font-extrabold tracking-[.1em] text-brand">Prize</p>
            {/* Never a guessed figure: the pool is printed only once it exists. */}
            <h3 className="font-extrabold text-display-sm">
              {show.prizeAmount ? `${money(show.prizeAmount)} pool` : COPY.tba}
            </h3>
            <p className="mt-auto text-pretty text-neutral-700">{prizeBody}</p>
          </Cell>

          <Cell index={3} className="flex min-h-[260px] flex-col gap-[18px]">
            <p className="text-sm font-extrabold tracking-[.1em] text-brand">Who</p>
            <h3 className="font-extrabold text-display-sm">{COPY.whoTitle}</h3>
            <p className="mt-auto text-pretty text-neutral-700">{COPY.whoBody}</p>
          </Cell>
        </CellGrid>
      </section>

      {/* ------------------------------------------------------ 03 / Promo */}

      {promo && (
        <section className="mx-auto max-w-shell px-gutter pt-section">
          <div className="grid gap-8 pb-[clamp(24px,3vw,40px)] min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:items-end min-[900px]:gap-[clamp(32px,5vw,96px)]">
            <Reveal>
              <Kicker>03 / Promo</Kicker>
              <h2 className="mt-5 text-balance font-extrabold text-display-md">
                {COPY.promoTitle}
              </h2>
            </Reveal>
            <Reveal index={1}>
              <ButtonLink
                href="/watch"
                variant="outline"
                size="lg"
                className="border-rule hover:border-ink hover:bg-transparent hover:text-ink"
              >
                All videos
              </ButtonLink>
            </Reveal>
          </div>

          <Reveal>
            <div className="relative aspect-video bg-ink">
              {/* nocookie host: the same embed without a tracking cookie set on
                  arrival, which is the only thing the design does not specify. */}
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${promo.videoId}?rel=0`}
                title={promo.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          </Reveal>
        </section>
      )}

      {/* -------------------------------------------------- closing poster */}

      <section className="mt-section-lg bg-brand text-ground">
        <div className="mx-auto grid max-w-shell gap-8 px-gutter py-section min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[900px]:items-end min-[900px]:gap-[clamp(32px,5vw,96px)]">
          <Reveal>
            <h2 className="font-extrabold uppercase text-display-xl">{COPY.ctaTitle}</h2>
          </Reveal>
          <Reveal index={1} className="flex flex-col gap-6 border-t-2 border-ground pt-6">
            <p className="text-pretty text-lede opacity-90">
              {takingEntries ? COPY.ctaOpen : COPY.ctaClosed}
            </p>
            <ButtonLink
              href={enterHref}
              variant="outline"
              size="lg"
              className="w-full border-ink bg-ink text-ground hover:border-neutral-900 hover:bg-neutral-900 hover:text-ground"
            >
              {takingEntries ? "Enter the contest" : "Register interest"}
            </ButtonLink>
          </Reveal>
        </div>
      </section>
    </>
  );
}
