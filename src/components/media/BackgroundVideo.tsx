"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { mediaVideo } from "@/lib/media";

type Props = {
  /** Path without an extension, e.g. "/media/hero/mic". */
  src: string;
  poster: string;
  className?: string;
};

/**
 * Hero background video that does not cost the page its LCP.
 *
 * A cinematic hero wants video; Core Web Vitals and mobile data plans do not.
 * The compromise:
 *
 *   1. The poster is the LCP element and the only thing that loads at first
 *      paint. It is a ~40 KB JPEG, so it lands fast even on a slow connection.
 *   2. Video is attached only after the page settles, and only when the
 *      connection can carry it. `preload="none"` until then, so nothing is
 *      fetched speculatively.
 *   3. It is skipped entirely on save-data, on 2g/3g, and when the visitor has
 *      asked for reduced motion. Those visitors keep the still, which is a
 *      complete design rather than a degraded one.
 *
 * The old site autoplays nine videos on the homepage, seven of them QuickTime
 * files no browser can decode. This is the correction.
 */
export function BackgroundVideo({ src, poster, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    // navigator.connection is Chromium-only; absence just means "no signal", so
    // the video is allowed rather than blocked.
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;

    if (conn?.saveData) return;
    if (conn?.effectiveType && /(^|-)([23]g|slow-2g)$/.test(conn.effectiveType)) return;

    // Wait for the main thread to be idle so the video never competes with the
    // poster, the fonts, or hydration. Safari has no requestIdleCallback, hence
    // the timeout path — and hence tracking which one was actually used, since
    // the two ids are not interchangeable.
    const start = () => setEnabled(true);
    const idle = typeof window.requestIdleCallback === "function";
    const id = idle ? window.requestIdleCallback(start) : window.setTimeout(start, 1200);

    return () => {
      if (idle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    el.load();
    // Autoplay can still be refused; the poster stays visible if so.
    void el.play().catch(() => {});
  }, [enabled]);

  const base = mediaVideo(src);

  return (
    <video
      ref={ref}
      poster={mediaVideo(poster)}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
      className={cn("h-full w-full object-cover", className)}
    >
      {enabled && (
        <>
          <source src={`${base}.webm`} type="video/webm" />
          <source src={`${base}.mp4`} type="video/mp4" />
        </>
      )}
    </video>
  );
}
