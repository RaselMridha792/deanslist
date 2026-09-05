"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** Stagger index. Each step adds 80ms, matching the design's i x 0.08s. */
  index?: number;
  className?: string;
  children: React.ReactNode;
};

/**
 * Scroll reveal: opacity 0 + translateY(28px) to none over .9s.
 *
 * The fallback is the point. Elements start hidden, so anything that fails to
 * be observed stays invisible forever — a blank page rather than an unanimated
 * one. IntersectionObserver can be throttled or never fire (a element already
 * on screen at mount in some browsers, a tab restored from bfcache, IO absent
 * entirely), so there are three independent ways to become visible:
 *
 *   1. the observer
 *   2. a scroll listener that measures against the viewport
 *   3. a 1.2s timer that reveals unconditionally
 *
 * Whichever wins, the element ends up visible. Reduced motion skips all of it
 * and renders visible immediately.
 */
export function Reveal({ index = 0, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const show = () => setShown(true);

    const nearViewport = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92 && r.bottom > 0;
    };

    if (nearViewport()) {
      show();
      return;
    }

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting)) show();
            },
            { threshold: 0.12 },
          )
        : null;
    io?.observe(el);

    const onScroll = () => {
      if (nearViewport()) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    // Last resort. Nothing stays hidden because an observer misfired.
    const timer = window.setTimeout(show, 1200);

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearTimeout(timer);
    };
  }, [shown]);

  return (
    <div
      ref={ref}
      className={cn("transition-all duration-[900ms] ease-dl", className)}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(28px)",
        transitionDelay: shown ? `${index * 80}ms` : "0ms",
      }}
    >
      {children}
    </div>
  );
}
