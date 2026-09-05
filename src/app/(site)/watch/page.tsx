import type { Metadata } from "next";
import Link from "next/link";

import { CellGrid } from "@/components/dl/CellGrid";
import { ButtonAnchor, ButtonLink } from "@/components/dl/Button";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { PlaySquare } from "@/components/dl/PlayIcon";
import { Reveal } from "@/components/dl/Reveal";
import { SectionHeading } from "@/components/dl/SectionHeading";
import { SITE } from "@/content/site";
import { getEpisodes, getShows, type Episode } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Watch",
  description:
    "Full episodes and highlights from every season, pulled from the official channel and organised by show.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ play?: string }> };

/**
 * The video library.
 *
 * One player at the top, a grid of thumbnails below, and only ever one live
 * iframe on the page. Six embeds would be roughly three megabytes of YouTube
 * JavaScript and six tracking contexts before the visitor has asked to watch
 * anything, so a thumbnail stays an `<img>` until it is clicked.
 *
 * The click is a link to `?play=<id>` rather than component state. That keeps
 * the whole page a Server Component, makes a chosen episode shareable and
 * linkable, and still works with JavaScript off. The id is never trusted: it is
 * matched against the episodes this page already loaded, so nothing but a known
 * video id can reach an iframe src.
 */
export default async function WatchPage({ searchParams }: Props) {
  const { play } = await searchParams;
  const [episodes, shows] = await Promise.all([getEpisodes(), getShows()]);

  const showTitle = new Map(shows.map((s) => [s.slug, s.title]));
  const labelFor = (e: Episode) => (e.showSlug ? (showTitle.get(e.showSlug) ?? null) : null);

  // "Every episode, by show": a stable grouping, so the order the dashboard
  // returns is preserved inside each show rather than resorted around it.
  const ordered = groupByShow(episodes);

  const requested = play ? ordered.find((e) => e.videoId === play) : undefined;
  const featured = requested ?? ordered[0] ?? null;
  const playing = Boolean(requested);

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden bg-ink text-ground">
        <div className="absolute inset-0 opacity-35">
          <GrayscaleImage
            src="/media/gallery/cts-11"
            alt=""
            priority
            hover={false}
            sizes="100vw"
            className="h-full w-full"
          />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-r from-ink from-[20%] to-ink/40"
          aria-hidden
        />

        <div className="shell relative grid gap-8 pb-[clamp(40px,5vw,72px)] pt-section min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[901px]:items-end min-[901px]:gap-16">
          <div className="animate-dl-rise">
            <Kicker onDark className="mb-5">
              Watch
            </Kicker>
            <h1 className="text-balance text-hero font-extrabold uppercase">From the stage.</h1>
          </div>
          <p
            className="animate-dl-rise max-w-[44ch] text-pretty text-lede text-ground/85"
            style={{ animationDelay: "200ms" }}
          >
            Full episodes and highlights from every season, pulled from the official channel and
            organised by show.
          </p>
        </div>
      </section>

      {featured === null ? (
        <section className="shell pt-section">
          <p className="max-w-[60ch] text-lede text-neutral-800">
            No episodes here yet. Everything goes live on{" "}
            <a
              href={SITE.socials.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-onLight underline underline-offset-4"
            >
              YouTube
            </a>{" "}
            first.
          </p>
        </section>
      ) : (
        <>
          {/* --------------------------------------------------- the player */}
          <section id="player" className="shell pt-section">
            <Reveal>
              {playing ? (
                <div className="relative aspect-video bg-ink">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${featured.videoId}?autoplay=1&rel=0`}
                    title={featured.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              ) : (
                <Link
                  href={`/watch?play=${featured.videoId}#player`}
                  aria-label={`Play ${featured.title}`}
                  className="group relative block aspect-video overflow-hidden bg-ink text-ground"
                >
                  <Thumbnail videoId={featured.videoId} priority />
                  <span className="absolute left-5 top-5">
                    <PlaySquare />
                  </span>
                </Link>
              )}
            </Reveal>

            <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-rule py-5">
              <div>
                <Kicker className="mb-1.5">
                  Now playing{labelFor(featured) ? ` / ${labelFor(featured)}` : ""}
                </Kicker>
                <h2 className="text-[clamp(20px,1.8vw,28px)] font-extrabold leading-tight tracking-[-.02em]">
                  {featured.title}
                </h2>
              </div>
              <ButtonAnchor href={SITE.socials.youtube} variant="outline" size="lg">
                Subscribe on YouTube
              </ButtonAnchor>
            </div>
          </section>

          {/* -------------------------------------------------- the library */}
          <section className="shell pt-section">
            {/*
              Sentence case, not the uppercase SectionHeading applies by
              default: this design reserves uppercase display type for the hero
              and the closing poster.

              The aside is deliberately an empty div. The design leaves that
              column blank; it exists only to hold the 5fr / 7fr split under the
              heading.
            */}
            <SectionHeading
              kicker="Library"
              title={<span className="normal-case">Every episode, by show.</span>}
              aside={<div />}
            />

            <CellGrid cols={3} className="border-b-2 border-rule">
              {ordered.map((e, i) => {
                const label = labelFor(e);
                return (
                  <Reveal key={e.videoId} index={i}>
                    <Link
                      href={`/watch?play=${e.videoId}#player`}
                      aria-label={`Play ${e.title}`}
                      aria-current={playing && e.videoId === featured.videoId ? "true" : undefined}
                      className="group relative block aspect-[16/10] overflow-hidden bg-ink text-ground"
                    >
                      <Thumbnail videoId={e.videoId} />
                      <span className="absolute left-5 top-5">
                        <PlaySquare />
                      </span>
                      <span className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
                        <span className="text-[clamp(16px,1.3vw,20px)] font-extrabold leading-[1.15] tracking-[-.02em]">
                          {e.title}
                        </span>
                        {label && (
                          <span className="whitespace-nowrap text-eyebrow font-semibold uppercase opacity-70">
                            {label}
                          </span>
                        )}
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </CellGrid>
          </section>
        </>
      )}

      {/* ---------------------------------------------------------- poster */}
      {/* Red as a full field. The only place on this page it is allowed to be. */}
      <section className="mt-section-lg bg-brand text-ground">
        <div className="shell grid items-end gap-[clamp(32px,5vw,96px)] py-section min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Reveal>
            <h2 className="text-[clamp(48px,7.5vw,140px)] font-extrabold uppercase leading-[.88] tracking-[-.05em]">
              Your stage awaits.
            </h2>
          </Reveal>

          <Reveal index={1} className="flex flex-col gap-6 border-t-2 border-ground pt-6">
            <p className="text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] text-ground/90">
              Entries are open. Four fields and one minute stand between you and the
              Principal&apos;s Roll.
            </p>
            {/*
              A black button on the red field. Not one of the four variants —
              none of them is a solid ink fill — but .btn still carries the
              flush-left label and the zero radius.
            */}
            <ButtonLink
              href="/enter"
              size="lg"
              className="w-full border-ink bg-ink text-ground hover:border-neutral-900 hover:bg-neutral-900"
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
 * YouTube's own still, in grayscale like every other image on the site.
 *
 * Not `GrayscaleImage`: that resolves an extensionless path against the media
 * host and derives .avif/.webp/.jpg from it, which a fully qualified i.ytimg.com
 * URL cannot take. `hqdefault` is the one size YouTube guarantees for every
 * video id: `maxresdefault` is sharper but 404s on older uploads, and a missing
 * thumbnail is worse than a soft one.
 */
function Thumbnail({ videoId, priority = false }: { videoId: string; priority?: boolean }) {
  return (
    <>
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        className="grayscale-media absolute inset-0 h-full w-full object-cover opacity-80 transition-[transform,opacity] duration-[1200ms] ease-dl group-hover:scale-[1.05] group-hover:opacity-100"
      />
      <span
        className="absolute inset-0 bg-gradient-to-b from-transparent from-[50%] to-ink/80"
        aria-hidden
      />
    </>
  );
}

/**
 * Group episodes by show, preserving the order each show first appears in and
 * the order of the episodes inside it. Sorting on the show slug would reshuffle
 * the whole library alphabetically the first time a show is renamed.
 */
function groupByShow(episodes: Episode[]): Episode[] {
  const order: (string | null)[] = [];
  for (const e of episodes) if (!order.includes(e.showSlug)) order.push(e.showSlug);
  return order.flatMap((slug) => episodes.filter((e) => e.showSlug === slug));
}
