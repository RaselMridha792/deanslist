import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Countdown } from "@/components/ui/Countdown";
import { BackgroundVideo } from "@/components/media/BackgroundVideo";
import type { Show } from "@/lib/queries";
import { SITE } from "@/content/site";

/**
 * The one screen that has to work. One primary action — enter — and everything
 * else subordinate to it.
 *
 * When the client has not confirmed a date, this renders the show's cadence
 * instead of a countdown. It never prints a guessed deadline: the old site's
 * "Show Starts August 11" contradicts its own winner story dated August 28, and
 * repeating that mistake in a redesign would be worse than making it once.
 */
export function Hero({ show }: { show: Show | null }) {
  const live = show?.status === "LIVE";
  const hasDeadline = Boolean(show?.entryDeadline);

  return (
    <section className="relative isolate min-h-[86svh] overflow-hidden border-b border-ink-line">
      <div className="absolute inset-0 -z-20">
        {show?.heroVideo && show?.heroPoster ? (
          <BackgroundVideo src={show.heroVideo} poster={show.heroPoster} />
        ) : (
          <div className="h-full w-full bg-ink-raised" />
        )}
      </div>

      {/*
        Two scrims, not one.

        The vertical one keeps type legible over whatever frame the video is on.
        The second is weighted to the right, because the hero footage carries the
        Dean's List wordmark in its left half — the copy used to sit on top of it
        and the two fought each other. The content is now right-aligned on
        desktop, over its own darkened panel, and the mark is left visible.

        On mobile there is no room for a side-by-side, so the layout falls back
        to full width and only the vertical scrim matters.
      */}
      <div className="absolute inset-0 -z-10 bg-hero-scrim" />
      <div className="absolute inset-0 -z-10 hidden bg-hero-scrim-right lg:block" />

      <div className="shell flex min-h-[86svh] flex-col justify-end pb-20 pt-32 md:pb-28">
        <div className="max-w-4xl lg:ml-auto lg:max-w-2xl lg:text-right">
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            {live ? (
              <Badge live>Live now</Badge>
            ) : show?.status === "OPEN" ? (
              <Badge>Entries open</Badge>
            ) : null}
            {show?.cadence && <Badge>{show.cadence}</Badge>}
          </div>

          <h1 className="mt-6 text-display-xl uppercase text-chalk animate-rise-in">
            {show?.title ?? SITE.name}
          </h1>

          <p className="mt-5 max-w-xl text-body-lg leading-relaxed text-chalk-body lg:ml-auto">
            {show?.tagline ?? SITE.tagline}
          </p>

          <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center lg:justify-end">
            <ButtonLink href="/enter" size="lg">
              Enter the contest
            </ButtonLink>
            <ButtonLink href="/watch" variant="ghost" size="lg">
              Watch an episode
            </ButtonLink>
          </div>

          {hasDeadline ? (
            <div className="mt-12 lg:flex lg:justify-end">
              <Countdown
                target={show!.entryDeadline!}
                label="Entries close in"
                expiredLabel="Entries closed for this round"
              />
            </div>
          ) : (
            <p className="mt-12 max-w-md text-sm text-chalk-faint lg:ml-auto">
              Entry is open now. The next show date is announced on{" "}
              <a
                href={SITE.socials.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline-offset-4 hover:underline"
              >
                YouTube
              </a>{" "}
              and{" "}
              <a
                href={SITE.socials.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline-offset-4 hover:underline"
              >
                Facebook
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
