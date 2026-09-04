"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  videoId: string;
  title: string;
  className?: string;
};

/**
 * Click-to-load YouTube.
 *
 * A real <iframe> costs roughly half a megabyte of JavaScript and sets cookies
 * before the visitor has asked for anything. On a grid of six episodes that is
 * three megabytes and six tracking contexts on first paint.
 *
 * So the card shows YouTube's own thumbnail until it is activated, then mounts
 * one iframe on the nocookie host. Keyboard accessible, because a div with an
 * onClick is not a button.
 */
export function VideoEmbed({ videoId, title, className }: Props) {
  const [active, setActive] = useState(false);

  if (active) {
    return (
      <div className={cn("relative aspect-video overflow-hidden rounded-card bg-black", className)}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      aria-label={`Play: ${title}`}
      className={cn(
        "group relative block aspect-video w-full overflow-hidden rounded-card border border-ink-line bg-ink-soft",
        className,
      )}
    >
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-slow ease-cine group-hover:scale-[1.04]"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />

      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-gloss shadow-brand-glow transition-transform duration-base ease-crisp group-hover:scale-110">
          <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-ink" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>

      <span className="absolute inset-x-0 bottom-0 p-4 text-left">
        <span className="line-clamp-2 text-sm font-semibold text-chalk">{title}</span>
      </span>
    </button>
  );
}
