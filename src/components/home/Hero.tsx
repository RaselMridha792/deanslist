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

      {/* Scrim. Without it, hero type sits on whatever frame the video happens
          to be on and contrast becomes a matter of luck. */}
      <div className="absolute inset-0 -z-10 bg-hero-scrim" />

      <div className="shell flex min-h-[86svh] flex-col justify-end pb-20 pt-32 md:pb-28">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-3">
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

          <p className="mt-5 max-w-xl text-body-lg leading-relaxed text-chalk-body">
            {show?.tagline ?? SITE.tagline}
          </p>

          <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center">
            <ButtonLink href="/enter" size="lg">
              Enter the contest
            </ButtonLink>
            <ButtonLink href="/watch" variant="ghost" size="lg">
              Watch an episode
            </ButtonLink>
          </div>

          {hasDeadline ? (
            <div className="mt-12">
              <Countdown
                target={show!.entryDeadline!}
                label="Entries close in"
                expiredLabel="Entries closed for this round"
              />
            </div>
          ) : (
            <p className="mt-12 max-w-md text-sm text-chalk-faint">
              Entry is open now. The next show date is announced on{" "}
              <a
                href={SITE.socials.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline-offset-4 hover:underline"
              >
                YouTube
              </a>{" "}
              and{" "}
              <a
                href={SITE.socials.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline-offset-4 hover:underline"
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
