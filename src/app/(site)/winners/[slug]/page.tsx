import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonAnchor, ButtonLink } from "@/components/dl/Button";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { PlaySquare } from "@/components/dl/PlayIcon";
import { Reveal } from "@/components/dl/Reveal";
import { SITE } from "@/content/site";
import { env } from "@/lib/env";
import { getEpisodes, getShow, getWinner } from "@/lib/queries";
import { breadcrumbJsonLd, jsonLdGraph, jsonLdScriptProps, winnerPersonJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/*
  The winner template.

  Every value on this page that names a fact — the show, the date, the prize,
  the story, the portrait, the reel — is read from the winner row so the client
  edits it in the dashboard. Nothing here hardcodes PJ Galloway, and a fact the
  row does not carry is omitted rather than guessed: `announcedAt` is null for
  both seeded winners because the old site dates the same challenge twice, so
  the Date row and the date clause simply do not render until someone confirms
  one. See docs/PROJECT-BRIEF.md section 8.
*/

/**
 * Performance reels the client has published but has not yet attached to a
 * winner row. The URL is from the handoff's asset list, not invented; the
 * moment `videoUrl` is set in the dashboard it wins.
 */
const PUBLISHED_REELS: Record<string, string> = {
  "pj-galloway": "https://www.facebook.com/reel/2271520033316942",
};

/**
 * Two-column grids, collapsing to one at 900px per the handoff. The breakpoint
 * is 901px rather than a Tailwind default because the design names 900px, and
 * SiteHeader already uses the same arbitrary-variant form for its own 1100px.
 */
const COL_5_7 =
  "grid gap-[clamp(32px,5vw,96px)] min-[901px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";
const COL_7_5 =
  "grid items-end gap-[clamp(32px,5vw,96px)] min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]";

/** "28 August 2025". Fixed to UTC so the server and the crawler agree. */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Money never abbreviates: $1,000, never $1K. */
function money(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const winner = await getWinner(slug);
  if (!winner) return { title: "Winner not found" };

  const title = winner.showTitle ? `${winner.name}, ${winner.showTitle} winner` : winner.name;

  return {
    title: winner.name,
    description: winner.story?.slice(0, 160) ?? title,
    alternates: { canonical: `/winners/${winner.slug}` },
    openGraph: {
      title,
      description: winner.story?.slice(0, 200) ?? undefined,
      url: `${env.NEXT_PUBLIC_SITE_URL}/winners/${winner.slug}`,
      type: "profile",
    },
  };
}

export default async function WinnerPage({ params }: Params) {
  const { slug } = await params;
  const winner = await getWinner(slug);
  if (!winner) notFound();

  const [show, showEpisodes] = await Promise.all([
    winner.showSlug ? getShow(winner.showSlug) : Promise.resolve(null),
    getEpisodes(winner.showSlug ?? undefined),
  ]);

  const announced = formatDate(winner.announcedAt);
  const prize = winner.prizeAwarded !== null ? money(winner.prizeAwarded) : null;

  /**
   * The hero image is texture, not a portrait: it sits at 35% behind a gradient
   * with an empty alt. A real portrait is preferred when the row carries one,
   * then the show's own key art, then the gallery frame the design uses.
   */
  const heroImage = winner.photoUrl ?? show?.keyArt ?? "/media/gallery/cts-02";

  const performanceUrl = winner.videoUrl ?? PUBLISHED_REELS[winner.slug] ?? null;

  const facts: { label: string; value: string }[] = [];
  if (winner.showTitle) facts.push({ label: "Show", value: winner.showTitle });
  if (announced) facts.push({ label: "Date", value: announced });
  if (prize) facts.push({ label: "Prize", value: prize });
  // Format, not a per-winner claim: every result on this platform is decided by
  // the live audience across YouTube and Facebook.
  facts.push({ label: "Decided by", value: "Global audience vote" });

  // The dashboard stores the story as prose. Blank lines become paragraphs; a
  // single block stays a single paragraph rather than being chopped up.
  const story = (winner.story ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const related = showEpisodes.slice(0, 2);

  const jsonLd = jsonLdGraph(
    winnerPersonJsonLd(winner),
    breadcrumbJsonLd([
      { name: "Winners", path: "/winners" },
      { name: winner.name, path: `/winners/${winner.slug}` },
    ]),
  );

  return (
    <>
      {jsonLd && <script {...jsonLdScriptProps(jsonLd)} />}

      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden bg-ink text-ground">
        <div className="absolute inset-0 -z-20">
          <GrayscaleImage
            src={heroImage}
            alt=""
            priority
            hover={false}
            sizes="100vw"
            className="h-full w-full opacity-35"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink from-20% to-ink/40" />

        <div className={`shell relative pb-[clamp(40px,5vw,72px)] pt-section ${COL_7_5}`}>
          <div className="animate-dl-rise">
            <Kicker onDark>
              {winner.showTitle ? `Principal's Roll / ${winner.showTitle}` : "Principal's Roll"}
            </Kicker>
            <h1 className="mt-5 text-balance text-display-lg font-extrabold uppercase">
              {winner.name}.
            </h1>
          </div>

          {(winner.showTitle || prize) && (
            <p className="max-w-[44ch] animate-dl-rise text-pretty text-lede opacity-85 [animation-delay:200ms]">
              {winner.showTitle
                ? `Winner of the ${winner.showTitle} challenge${announced ? `, ${announced}` : ""}.`
                : `Winner${announced ? `, ${announced}` : ""}.`}
              {prize ? ` ${prize} prize.` : ""}
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------- facts and story */}
      <section className={`shell pt-section ${COL_5_7}`}>
        {/* Rows separated by 2px rules: a gap over a rule-coloured ground, the
            same construction as the cell grid, so no row needs an override. */}
        <div className="flex flex-col gap-[2px] self-start bg-rule">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="grid grid-cols-[120px_1fr] gap-4 bg-ground py-[18px]"
            >
              <span className="pt-1 text-eyebrow font-semibold uppercase text-neutral-600">
                {fact.label}
              </span>
              <span className="text-[clamp(18px,1.5vw,24px)] font-extrabold tracking-[-.02em]">
                {fact.value}
              </span>
            </div>
          ))}

          <div className="flex flex-wrap gap-3 bg-ground pt-5">
            {performanceUrl && (
              /* Linked, never embedded. The reel is a Facebook URL and an
                 inline iframe would set third-party cookies on page load. */
              <ButtonAnchor
                href={performanceUrl}
                variant="primary"
                size="lg"
                className="min-h-[44px]"
              >
                Watch the winning performance
              </ButtonAnchor>
            )}
            <ButtonLink href="/winners" variant="outline" size="lg" className="min-h-[44px]">
              All winners
            </ButtonLink>
          </div>
        </div>

        <Reveal>
          <Kicker>The story</Kicker>
          <h2 className="mb-7 mt-5 text-balance text-[clamp(32px,3.6vw,64px)] font-extrabold leading-[.95] tracking-[-.04em]">
            {winner.showTitle
              ? `${winner.showTitle} winner: ${winner.name}.`
              : `Winner: ${winner.name}.`}
          </h2>

          {story.length > 0 && (
            <div className="flex max-w-[60ch] flex-col gap-5 text-pretty text-[clamp(16px,1.25vw,20px)] leading-[1.6] text-neutral-800">
              {story.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          )}
        </Reveal>
      </section>

      {/* -------------------------------------------------- related videos */}
      {related.length > 0 && (
        <section className="shell pt-section">
          <div className={`${COL_5_7} items-end pb-[clamp(24px,3vw,40px)]`}>
            <Reveal>
              <Kicker>From the challenge</Kicker>
              <h2 className="mt-5 text-balance text-display-md font-extrabold">
                {winner.showTitle ?? SITE.name} on screen.
              </h2>
            </Reveal>
          </div>

          <div className="grid gap-[2px] bg-rule min-[901px]:grid-cols-2">
            {related.map((episode, i) => (
              <Reveal key={episode.videoId} index={i} className="bg-ground">
                {/* A thumbnail that links out rather than an iframe: six
                    hundred kilobytes of player and a tracking cookie should
                    not load before anyone has asked to watch anything. The
                    thumbnail is an external URL, so it cannot go through
                    GrayscaleImage, which builds an avif/webp/jpg set from a
                    media path. The grayscale filter is the same one. */}
                <a
                  href={`https://www.youtube.com/watch?v=${episode.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-[16/9] overflow-hidden bg-ink"
                >
                  <img
                    src={`https://i.ytimg.com/vi/${episode.videoId}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="grayscale-media h-full w-full object-cover transition-transform duration-[1200ms] ease-dl group-hover:scale-[1.05]"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
                  <span className="absolute inset-0 grid place-items-center text-ground">
                    <PlaySquare />
                  </span>
                  <span className="absolute bottom-4 left-4 right-4 text-eyebrow font-semibold uppercase text-ground">
                    {episode.title}
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------- closing poster */}
      {/* One of the two places red is a full field. The other is the ticker. */}
      <section className="mt-section-lg bg-brand text-ground">
        <div className={`shell py-section ${COL_7_5}`}>
          <Reveal>
            <h2 className="text-display-xl font-extrabold uppercase">Your stage awaits.</h2>
          </Reveal>

          <Reveal index={1}>
            <div className="flex flex-col gap-6 border-t-2 border-ground pt-6">
              <p className="text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] opacity-90">
                Entries are open. Four fields and one minute stand between you and the Principal's
                Roll.
              </p>
              {/* Black on red. No variant carries this pairing, so the fill is
                  set here from tokens rather than a new one-off in the CSS. */}
              <ButtonLink
                href="/enter"
                variant="outline"
                size="lg"
                className="min-h-[44px] w-full border-ink bg-ink text-ground hover:border-neutral-900 hover:bg-neutral-900 hover:text-ground"
              >
                Enter the contest
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
