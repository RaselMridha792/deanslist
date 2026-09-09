import type { Metadata } from "next";
import Link from "next/link";

import { ButtonAnchor, ButtonLink } from "@/components/dl/Button";
import { Countdown } from "@/components/dl/Countdown";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { VideoPlayer } from "@/components/dl/VideoPlayer";
import { SITE } from "@/content/site";
import { getCurrentShow, getLatestWinner } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Watch live",
  description:
    "Drop That Mike, live. The audience comments FREEZE to push the prize up and PASS to end the act. Watch and vote as it happens.",
};

// This page is about the current moment, so it can never be cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Where to send someone who has just heard the show is on.
 *
 * The site's other pages assume a visitor with time. This one assumes the
 * opposite: they heard about the show from a post or a friend, they are
 * arriving mid-broadcast, and everything except "where do I watch" is noise.
 *
 * It changes with the show rather than with the clock, because the clock lies.
 * A show that starts late is still not live, and a countdown that has run out
 * is not a stream. `Show.status` is what the team actually sets, so it is what
 * decides:
 *
 *   LIVE            the stream, and how the voting works
 *   OPEN or DRAFT   a countdown, but only if a real date exists
 *   anything else   the last winner and where to watch the replay
 *
 * The FREEZE and PASS explanation is on this page and not only on the show page
 * because it is the thing a first-time viewer has to understand within about
 * ten seconds of arriving, or they watch without joining in — and joining in IS
 * the show.
 */
export default async function LivePage() {
  const [show, winner] = await Promise.all([
    getCurrentShow(),
    getLatestWinner(),
  ]);

  const isLive = show?.status === "LIVE";
  const startsAt = show?.startsAt ? new Date(show.startsAt) : null;
  const upcoming =
    !isLive && startsAt !== null && startsAt.getTime() > Date.now();

  const mechanic = [
    {
      word: "FREEZE",
      body: "Comment FREEZE while an act is on and the prize money goes up. The more of you, the more they take home.",
    },
    {
      word: "PASS",
      body: "Comment PASS and the pot stops climbing. Enough of them and the act is over.",
    },
  ];

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="bg-ink text-ground">
        <div className="shell pb-[clamp(32px,4vw,56px)] pt-[clamp(40px,5vw,80px)]">
          <div className="flex flex-wrap items-center gap-4">
            {isLive ? (
              <span className="inline-flex items-center gap-2.5 bg-brand px-4 py-2 text-kicker font-semibold uppercase text-white">
                <span
                  aria-hidden
                  className="h-2 w-2 animate-dl-pulse bg-white"
                />
                Live now
              </span>
            ) : (
              <Kicker onDark>{upcoming ? "Next show" : "Between shows"}</Kicker>
            )}
            {show?.title && !isLive && (
              <span className="text-kicker font-semibold uppercase text-ground/60">
                {show.title}
              </span>
            )}
          </div>

          <h1 className="mt-6 max-w-[16ch] text-balance text-hero font-extrabold uppercase">
            {isLive
              ? show?.title
                ? `${show.title} is on.`
                : "We are live."
              : upcoming
                ? "Doors are not open yet."
                : "No show on right now."}
          </h1>

          <p className="mt-5 max-w-[52ch] text-pretty text-lede text-ground/85">
            {isLive
              ? "Watch below and comment on the stream. The prize money moves while you do it."
              : upcoming
                ? "The stream appears here the moment we go live. Nothing to install and nothing to sign up for."
                : "Shows are announced on the channels and to the email list first. The last one is below."}
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- player */}
      <section className="bg-ink pb-section text-ground">
        <div className="shell">
          {isLive && show?.liveUrl ? (
            <Reveal>
              <VideoPlayer
                provider={
                  /youtu\.?be/i.test(show.liveUrl) ? "youtube" : "facebook"
                }
                id={
                  /youtu\.?be/i.test(show.liveUrl)
                    ? (show.liveUrl.match(
                        /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i,
                      )?.[1] ?? show.liveUrl)
                    : show.liveUrl
                }
                title={show.title ? `${show.title}, live` : "Live now"}
                ratio="16/9"
                poster={
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink">
                    <span className="text-kicker font-semibold uppercase text-brand-onDark">
                      Live now
                    </span>
                    <span className="text-[clamp(20px,2vw,30px)] font-extrabold uppercase tracking-[-.02em]">
                      Press play
                    </span>
                  </div>
                }
              />
            </Reveal>
          ) : isLive ? (
            /* Live, but nobody pasted the stream link in. Say so plainly and
               send people to the channels rather than showing a dead frame. */
            <Reveal className="border-2 border-rule-dark p-[clamp(24px,4vw,56px)]">
              <p className="text-lede text-ground/85">
                We are live now. The stream is on the channels below.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonAnchor
                  href={SITE.socials.facebook}
                  variant="outline-dark"
                  size="lg"
                >
                  Watch on Facebook
                </ButtonAnchor>
                <ButtonAnchor
                  href={SITE.socials.youtube}
                  variant="outline-dark"
                  size="lg"
                >
                  Watch on YouTube
                </ButtonAnchor>
              </div>
            </Reveal>
          ) : upcoming && startsAt ? (
            <Reveal className="border-2 border-rule-dark p-[clamp(24px,4vw,56px)]">
              <Kicker onDark>Starts in</Kicker>
              <div className="mt-6">
                <Countdown target={startsAt.toISOString()} />
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/register" size="lg">
                  Register to perform
                </ButtonLink>
                <ButtonAnchor
                  href={SITE.socials.facebook}
                  variant="outline-dark"
                  size="lg"
                >
                  Follow on Facebook
                </ButtonAnchor>
              </div>
            </Reveal>
          ) : (
            /* Between shows. The last winner is the most useful thing here: it
               answers "is this real" for someone who arrived from a post. */
            <Reveal className="grid gap-[2px] bg-rule-dark min-[901px]:grid-cols-2">
              <div className="flex flex-col justify-center gap-5 bg-ink p-[clamp(24px,3vw,48px)]">
                <Kicker onDark>Last winner</Kicker>
                <p className="text-[clamp(28px,3vw,48px)] font-extrabold leading-[.95] tracking-[-.03em]">
                  {winner?.name ?? "Announced on the show"}
                </p>
                {winner?.prizeAwarded !== null &&
                  winner?.prizeAwarded !== undefined && (
                    <p className="text-lede text-ground/80">
                      Took home ${winner.prizeAwarded.toLocaleString("en-US")}.
                    </p>
                  )}
                <div className="mt-2 flex flex-wrap gap-3">
                  <ButtonLink href="/watch" variant="outline-dark">
                    Watch the replays
                  </ButtonLink>
                  {winner?.slug && (
                    <ButtonLink
                      href={`/winners/${winner.slug}`}
                      variant="ghost-dark"
                    >
                      Read their story
                    </ButtonLink>
                  )}
                </div>
              </div>
              <GrayscaleImage
                src="/media/gallery/cts-03"
                alt=""
                ratio="16/10"
                hover={false}
                sizes="(min-width: 901px) 50vw, 100vw"
                className="h-full w-full"
              />
            </Reveal>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ mechanic */}
      <section className="shell pt-section">
        <Reveal className="border-b-2 border-rule pb-[clamp(24px,3vw,40px)]">
          <Kicker>How the voting works</Kicker>
          <h2 className="mt-5 text-balance text-display-md font-extrabold">
            You decide what they win.
          </h2>
          <p className="mt-5 max-w-[54ch] text-pretty text-lede text-neutral-800">
            The prize is not fixed. It moves while the act is on, and it moves
            because of what the crowd types in the live chat.
          </p>
        </Reveal>

        <div className="grid gap-[2px] border-b-2 border-rule bg-rule sm:grid-cols-2">
          {mechanic.map((m) => (
            <div
              key={m.word}
              className="flex flex-col gap-4 bg-ground p-[clamp(24px,3vw,44px)]"
            >
              <p className="text-[clamp(32px,4vw,64px)] font-extrabold uppercase leading-none tracking-[-.04em] text-brand">
                {m.word}
              </p>
              <p className="text-pretty text-body text-neutral-700">{m.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-[62ch] text-[14px] text-neutral-600">
          Voting happens in the comments on the live stream, not on this page.
          That is where the show is, and where everyone else is.
        </p>
      </section>

      {/* ------------------------------------------------------- closing */}
      <section className="mt-section-lg bg-brand text-ground">
        <div className="shell grid items-end gap-[clamp(32px,5vw,96px)] py-section min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Reveal>
            <h2 className="text-[clamp(40px,7vw,120px)] font-extrabold uppercase leading-[.88] tracking-[-.05em]">
              One voice. One chance.
            </h2>
          </Reveal>

          <Reveal
            index={1}
            className="flex flex-col gap-6 border-t-2 border-ground pt-6"
          >
            <p className="text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] text-ground">
              Watching is one thing. Being the act everyone is voting on is
              another. Entering is free.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="btn btn-lg border-ink bg-ink text-ground hover:border-neutral-900 hover:bg-neutral-900"
              >
                Register to perform
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
