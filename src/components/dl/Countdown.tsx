"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function partsUntil(target: number): Parts | null {
  const ms = target - Date.now();
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  };
}

/** Next Tuesday at 20:00 in the visitor's own zone. */
function nextTuesday8pm(): number {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  // 2 = Tuesday. If it is already past 8pm on a Tuesday, roll to the next one.
  const delta = (2 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (delta === 0 && Date.now() > d.getTime() ? 7 : delta));
  return d.getTime();
}

/**
 * Four cells on a 2px top rule: days, hours, minutes, seconds. Seconds in red.
 *
 * `target` comes from the Shows manager when the client has set a date. With no
 * confirmed date it falls back to next Tuesday 20:00, which is the show's own
 * stated cadence — the one thing about the schedule the old site is consistent
 * about. It never invents a specific calendar date.
 *
 * Hydration-safe: the server and the browser evaluate Date.now() at different
 * moments, so the first client render reproduces the server's dashes exactly
 * and the real figures appear only from the effect.
 */
export function Countdown({
  target,
  onDark = false,
  className,
}: {
  target?: string | null;
  onDark?: boolean;
  className?: string;
}) {
  const [parts, setParts] = useState<Parts | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const explicit = target ? new Date(target).getTime() : NaN;
    const ms = Number.isNaN(explicit) ? nextTuesday8pm() : explicit;

    setParts(partsUntil(ms));
    setReady(true);
    const id = setInterval(() => setParts(partsUntil(ms)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const cells: [string, number | null][] = [
    ["Next show", parts?.days ?? null],
    ["Hours", parts?.hours ?? null],
    ["Minutes", parts?.minutes ?? null],
    ["Seconds", parts?.seconds ?? null],
  ];

  const expired = ready && parts === null;

  return (
    <div className={cn("max-w-countdown", className)}>
      <div className={cn("grid grid-cols-4", onDark ? "divider-dark" : "divider")}>
        {cells.map(([label, value], i) => (
          <div key={label} className="pr-4 pt-4">
            <p
              className={cn(
                "font-extrabold tabular-nums leading-none",
                "text-[clamp(28px,3.4vw,52px)] tracking-[-.04em]",
                i === 3 && (onDark ? "text-brand-onDark" : "text-brand"),
              )}
            >
              {/* Dashes before the effect runs, identical on server and client. */}
              {expired ? "00" : value === null ? "--" : String(value).padStart(2, "0")}
            </p>
            <p
              className={cn(
                "mt-2 text-eyebrow font-semibold uppercase",
                onDark ? "text-ground/60" : "text-neutral-600",
              )}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
