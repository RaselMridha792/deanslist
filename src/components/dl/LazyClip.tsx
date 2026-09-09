"use client";

import { useEffect, useRef, useState } from "react";
import { mediaImage, mediaVideo } from "@/lib/media";
import { cn } from "@/lib/cn";

/**
 * A looping muted clip that only downloads once it is on screen.
 *
 * `preload="none"` reads like it should be enough and is not: **autoplay
 * overrides it**. A muted autoplaying video is fetched immediately whatever the
 * preload hint says, which is why the homepage shipped 5.2 MB of video before
 * anyone had scrolled — ten clips, all of them at once, nine of them below the
 * fold.
 *
 * That is money on paid traffic. An ad click arrives on mobile data and leaves
 * while the page is still loading, so the bytes are spent on people who never
 * reach the form.
 *
 * So the `<source>` elements are not rendered at all until an
 * IntersectionObserver says the clip is near the viewport. Until then the poster
 * frame is the whole of it, which is what the strip looks like at rest anyway.
 *
 * Three things this deliberately does NOT do:
 *
 *   it does not unload a clip that scrolls back off. Re-downloading the same
 *     file every time somebody scrolls past is worse than holding it
 *   it does not wait for full visibility. `rootMargin` starts the fetch a
 *     screen early, so a clip is playing by the time it is looked at
 *   it does not fall back to nothing. Without IntersectionObserver — or with
 *     JavaScript off — the sources render immediately, which is exactly the old
 *     behaviour. A performance optimisation that can leave a blank cell is not
 *     one worth having.
 */
export function LazyClip({
  src,
  ratio = "9/16",
  label,
  color = false,
  className,
}: {
  src: string;
  ratio?: string;
  label?: string;
  /** Render the footage in its own colour instead of the site's grayscale. */
  color?: boolean;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);

  // Starts true only where the observer is unavailable, so those browsers get
  // the old eager behaviour rather than a poster that never becomes a video.
  const [load, setLoad] = useState(
    () => typeof window !== "undefined" && !("IntersectionObserver" in window),
  );

  useEffect(() => {
    if (load) return;
    const el = frame.current;
    if (!el) return;

    if (!("IntersectionObserver" in window)) {
      setLoad(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoad(true);
          io.disconnect();
        }
      },
      // One viewport of lead time: the file is fetched while the strip is still
      // below the fold, so it is playing by the time it is read.
      { rootMargin: "100% 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  const v = mediaVideo(src);
  const poster = mediaImage(src);

  return (
    <div
      ref={frame}
      className={cn("group relative overflow-hidden bg-neutral-900", className)}
      style={{ aspectRatio: ratio }}
    >
      <video
        // The poster is on the element from the first paint, so the cell is
        // never empty and nothing shifts when the video arrives.
        poster={`${poster}.jpg`}
        muted
        loop
        playsInline
        autoPlay
        preload="none"
        aria-hidden
        tabIndex={-1}
        className={cn(
          "h-full w-full object-cover",
          !color && "grayscale-media",
        )}
      >
        {load && (
          <>
            <source src={`${v}.webm`} type="video/webm" />
            <source src={`${v}.mp4`} type="video/mp4" />
          </>
        )}
      </video>
      {label && (
        <span className="absolute bottom-3 left-3 text-eyebrow font-semibold uppercase text-white">
          {label}
        </span>
      )}
    </div>
  );
}
