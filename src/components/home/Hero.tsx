import { ButtonLink } from "@/components/dl/Button";
import { Countdown } from "@/components/dl/Countdown";
import { PlayIcon } from "@/components/dl/PlayIcon";
import { HeroEntryForm } from "@/components/home/HeroEntryForm";
import { mediaImage, mediaVideo } from "@/lib/media";
import type { Show, Winner } from "@/lib/queries";

/**
 * The one screen the whole rebuild turns on: 7fr of copy, 5fr of lead capture,
 * over a grayscale loop of the client's own footage.
 *
 * Two things here are deliberate and easy to undo by accident.
 *
 * The background is hand-rolled rather than GrayscaleImage/GrayscaleClip. Those
 * primitives own their own positioning (`relative`, a fixed aspect-ratio) and a
 * full-bleed layer needs `absolute inset-0`, which a Tailwind `relative` in the
 * primitive would win against. The `grayscale-media` class is the same filter
 * they apply, so nothing about the look changes. It also sidesteps the AVIF
 * source GrayscaleImage emits: /media/hero carries only .webp and .jpg, and a
 * <picture> does not fall back when a listed source 404s.
 *
 * On mobile the card falls below the copy purely from source order, so nothing
 * needs reordering at the breakpoint.
 */

const DEFAULT_CLIP = "/media/hero/mic";

/**
 * Dashboard-set media only counts if it points at the media tree. `heroVideo`
 * maps to Show.trailerUrl, which a client could reasonably fill with a YouTube
 * link; appending ".mp4" to that would produce a silently broken hero.
 */
function localMedia(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/media/")) return null;
  return path.replace(/\.[a-z0-9]+$/i, "");
}

export function Hero({
  show,
  winner,
  statusLabel,
}: {
  show: Show | null;
  winner: Winner | null;
  statusLabel: string;
}) {
  const clip = localMedia(show?.heroVideo) ?? DEFAULT_CLIP;
  const poster = localMedia(show?.heroPoster) ?? clip;
  const posterBase = mediaImage(poster);
  const clipBase = mediaVideo(clip);

  return (
    <section
      id="show"
      className="relative flex min-h-[calc(100svh-theme(spacing.header))] flex-col overflow-hidden bg-ink text-ground"
    >
      {/* Footage at .55, so type sits on it rather than fighting it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.55]">
        <picture>
          <source srcSet={`${posterBase}.webp`} type="image/webp" />
          <img
            src={`${posterBase}.jpg`}
            alt=""
            fetchPriority="high"
            className="grayscale-media absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        <video
          poster={`${posterBase}.jpg`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
          className="grayscale-media absolute inset-0 h-full w-full object-cover"
        >
          <source src={`${clipBase}.webm`} type="video/webm" />
          <source src={`${clipBase}.mp4`} type="video/mp4" />
        </video>
      </div>

      {/* Horizontal scrim carries the copy column; vertical one lands the
          section into the black ticker rule below it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/[.88] via-ink/[.55] via-55% to-ink/[.3]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-60% to-ink"
      />

      <div className="relative mx-auto grid w-full max-w-shell flex-1 items-center gap-[clamp(32px,4vw,64px)] px-gutter py-[clamp(40px,6vw,88px)] min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex flex-col gap-7">
          <div className="flex flex-wrap items-center gap-[14px] text-[12px] font-semibold uppercase tracking-[.16em] motion-safe:animate-dl-rise">
            <span className="inline-flex items-center gap-2 bg-brand px-[10px] py-[6px] text-white">
              <span
                aria-hidden
                className="inline-block h-[6px] w-[6px] bg-white motion-safe:animate-dl-pulse"
              />
              Live every Tuesday
            </span>
            <span className="opacity-75">YouTube and Facebook</span>
          </div>

          <h1 className="m-0 max-w-[14ch] text-hero font-extrabold uppercase">
            <span
              className="block motion-safe:animate-dl-rise"
              style={{ animationDelay: "100ms" }}
            >
              {show?.title ?? "Drop That Mike"}.
            </span>
            <span
              className="block text-brand-onDark motion-safe:animate-dl-rise"
              style={{ animationDelay: "250ms" }}
            >
              You control the cash.
            </span>
          </h1>

          <p
            className="m-0 max-w-[44ch] text-lede opacity-85 motion-safe:animate-dl-rise"
            style={{ animationDelay: "400ms" }}
          >
            Perform from home. The audience votes live and the $1,000 prize pool drains in real
            time. Hit Freeze to lock the pot, or Pass and watch it fall.
          </p>

          <div
            className="flex flex-wrap gap-3 motion-safe:animate-dl-rise"
            style={{ animationDelay: "550ms" }}
          >
            <ButtonLink href="#watch" variant="outline-dark" size="lg">
              <PlayIcon />
              Watch the promo
            </ButtonLink>
            {winner && (
              <ButtonLink href="#winner" variant="ghost-dark" size="lg" className="px-6">
                Latest winner: {winner.name}
              </ButtonLink>
            )}
          </div>

          <div className="motion-safe:animate-dl-rise" style={{ animationDelay: "700ms" }}>
            <Countdown target={show?.startsAt ?? null} onDark />
          </div>
        </div>

        <HeroEntryForm showSlug={show?.slug} statusLabel={statusLabel} />
      </div>
    </section>
  );
}
