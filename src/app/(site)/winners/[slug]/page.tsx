import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonAnchor, ButtonLink } from "@/components/dl/Button";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { VideoPlayer } from "@/components/dl/VideoPlayer";
import { SITE } from "@/content/site";
import { env } from "@/lib/env";
import { getEpisodes, getShow, getWinner } from "@/lib/queries";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  jsonLdScriptProps,
  winnerPersonJsonLd,
} from "@/lib/seo";

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
 * Two-column grids, collapsing to one at 900px per the handoff. The breakpoint
 * is 901px rather than a Tailwind default because the design names 900px, and
 * SiteHeader already uses the same arbitrary-variant form for its own 1100px.
 */
/**
 * Which player a winner's video needs. `videoUrl` is free text in the
 * dashboard, so it can be a Facebook reel (what the client publishes today), a
 * YouTube link, or a bare id. Guessing wrong renders an empty frame.
 */
function isFacebook(url: string): boolean {
  return /(^|\.)facebook\.com\//i.test(url) || /(^|\.)fb\.watch\//i.test(url);
}

/** The id out of any of YouTube's URL shapes, or null if it is not one. */
function youTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i,
  );
  return m ? m[1] : null;
}

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

  const title = winner.showTitle
    ? `${winner.name}, ${winner.showTitle} winner`
    : winner.name;

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
  const prize =
    winner.prizeAwarded !== null ? money(winner.prizeAwarded) : null;

  /**
   * The hero image is texture, not a portrait: it sits at 35% behind a gradient
   * with an empty alt. A real portrait is preferred when the row carries one,
   * then the show's own key art, then the gallery frame the design uses.
   */
  const heroImage = winner.photoUrl ?? show?.keyArt ?? "/media/gallery/cts-02";

  const performanceUrl = winner.videoUrl;

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

        <div
          className={`shell relative pb-[clamp(40px,5vw,72px)] pt-section ${COL_7_5}`}
        >
          <div className="animate-dl-rise">
            <Kicker onDark>
              {winner.showTitle
                ? `Principal's Roll / ${winner.showTitle}`
                : "Principal's Roll"}
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
              /* Opens on the platform that hosts it. The performance also plays
                 on this page, in the block below; this is for anyone who wants
                 the comments, the share sheet, or the client's own page. */
              <ButtonAnchor
                href={performanceUrl}
                variant="outline"
                size="lg"
                className="min-h-[44px]"
              >
                Open on Facebook
              </ButtonAnchor>
            )}
            <ButtonLink
              href="/winners"
              variant="outline"
              size="lg"
              className="min-h-[44px]"
            >
              All winners
            </ButtonLink>
          </div>
        </div>

        {performanceUrl && (
          <Reveal className="mb-[clamp(32px,4vw,64px)]">
            <Kicker>The winning performance</Kicker>
            {/*
              A reel is shot vertically, so it is capped rather than stretched:
              a 9:16 frame forced across this column would be a wall of video
              with the performer cropped out of the middle of it.

              Nothing from Facebook loads until the play control is pressed. The
              button IS the consent: an inline iframe here would set third-party
              cookies on page load, for every visitor, including the ones who
              only came to read the story.
            */}
            <div className="mt-5 max-w-[min(340px,100%)]">
              <VideoPlayer
                provider={isFacebook(performanceUrl) ? "facebook" : "youtube"}
                id={
                  isFacebook(performanceUrl)
                    ? performanceUrl
                    : (youTubeId(performanceUrl) ?? performanceUrl)
                }
                title={`${winner.name}, the winning performance`}
                ratio="9/16"
                poster={
                  <div className="flex h-full w-full items-center justify-center bg-ink">
                    <span className="text-kicker font-semibold uppercase text-ground/40">
                      Press play
                    </span>
                  </div>
                }
              />
            </div>
          </Reveal>
        )}

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
                {/* Plays here. The iframe is not loaded until the click that
                    starts it, so no player script and no tracking cookie
                    arrive before anyone has asked to watch. */}
                <VideoPlayer
                  id={episode.videoId}
                  title={episode.title}
                  ratio="16/9"
                >
                  <span className="absolute bottom-4 left-4 right-4 text-eyebrow font-semibold uppercase text-ground">
                    {episode.title}
                  </span>
                </VideoPlayer>
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
            <h2 className="text-display-xl font-extrabold uppercase">
              Your stage awaits.
            </h2>
          </Reveal>

          <Reveal index={1}>
            <div className="flex flex-col gap-6 border-t-2 border-ground pt-6">
              <p className="text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] opacity-90">
                Entries are open. Four fields and one minute stand between you
                and the Principal's Roll.
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
