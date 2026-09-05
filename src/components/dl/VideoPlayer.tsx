"use client";

import { useState } from "react";
import { PlaySquare } from "@/components/dl/PlayIcon";
import { cn } from "@/lib/cn";

/**
 * Play a video without leaving the page.
 *
 * It is a facade, not a live embed. Nothing third-party loads until someone
 * presses play: a YouTube iframe is roughly half a megabyte of script and sets
 * a tracking context on sight, so six of them on the homepage would be about
 * three megabytes on first paint and a set of cookies nobody asked for. What
 * renders first is a thumbnail and a button; the iframe replaces it on click,
 * with autoplay, so the press that reveals the player is also the press that
 * starts it. One interaction, not two.
 *
 * That reasoning is why the site previously linked out instead of embedding.
 * The facade is what makes both things true at once: the visitor watches here,
 * and a visitor who never presses play is never handed to YouTube or Meta.
 *
 * Providers differ in one way that matters. YouTube publishes a thumbnail at a
 * predictable URL, so the poster is free. Facebook does not without an access
 * token, so a Facebook video takes whatever poster the caller gives it, and
 * `poster` accepts a node rather than a URL so a caller can hand over something
 * it already renders.
 */

type Provider = "youtube" | "facebook";

/**
 * `id` is the YouTube video id, or the full Facebook permalink.
 *
 * Facebook's plugin takes an encoded permalink and needs no SDK. `autoplay`
 * only takes effect because the iframe is created by a click, which is the
 * gesture browsers require before a video may start with sound.
 */
function embedSrc(provider: Provider, id: string): string {
  if (provider === "facebook") {
    const params = new URLSearchParams({
      href: id,
      show_text: "false",
      autoplay: "true",
      allowfullscreen: "true",
    });
    return `https://www.facebook.com/plugins/video.php?${params.toString()}`;
  }
  // youtube-nocookie defers the tracking cookie until playback, which is the
  // one moment the visitor has actually asked for it.
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}

export function VideoPlayer({
  provider = "youtube",
  id,
  title,
  poster,
  ratio = "16/9",
  className,
  children,
}: {
  provider?: Provider;
  /** YouTube video id, or a full Facebook video/reel permalink. */
  id: string;
  /** Names the video for a screen reader, and titles the iframe. */
  title: string;
  /**
   * What shows before play. Omit for YouTube and the published thumbnail is
   * used. Facebook has no public thumbnail, so pass one.
   */
  poster?: React.ReactNode;
  ratio?: string;
  className?: string;
  /** Rendered over the poster, under the play control. Captions, labels. */
  children?: React.ReactNode;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className={cn("relative overflow-hidden bg-ink text-ground", className)}
      style={{ aspectRatio: ratio }}
    >
      {playing ? (
        <iframe
          src={embedSrc(provider, id)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${title}`}
          className="group absolute inset-0 block h-full w-full cursor-pointer border-0 bg-transparent p-0 text-left text-ground"
        >
          {poster ?? (
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-80 transition-[transform,opacity] duration-[1200ms] ease-dl group-hover:scale-[1.05] group-hover:opacity-100"
            />
          )}

          {/* Bottom scrim so a caption sitting over the poster stays readable
              whatever the frame behind it happens to be. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-transparent from-50% to-ink/80"
          />

          <PlaySquare className="absolute left-5 top-5 transition-colors duration-200 ease-dl group-hover:border-brand group-hover:text-brand" />

          {children}
        </button>
      )}
    </div>
  );
}
