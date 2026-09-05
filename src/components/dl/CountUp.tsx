"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts to `value` over 1.6s on an ease-out cubic, once, when revealed.
 *
 * Renders the final value on the server and until the effect runs, so the
 * number is correct with JavaScript disabled and there is no hydration gap.
 * Reduced motion skips the animation entirely.
 */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || started.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const run = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1600);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(Math.round(value * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      setN(0);
      requestAnimationFrame(tick);
    };

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && run(), {
            threshold: 0.4,
          })
        : null;
    io?.observe(el);
    const timer = window.setTimeout(run, 1500);

    return () => {
      io?.disconnect();
      window.clearTimeout(timer);
    };
  }, [value]);

  return (
    <span ref={ref}>
      {prefix}
      {n.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}
