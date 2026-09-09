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

/**
 * Four cells on a 2px top rule: days, hours, minutes, seconds. Seconds in red.
 *
 * WITH NO TARGET, THIS RENDERS NOTHING.
 *
 * It used to fall back to "next Tuesday at 20:00" and present that as a real
 * countdown. Two things were wrong with it. The hour was invented — the client's
 * own poster says 7PM EST — and it was computed in the VISITOR'S zone, so two
 * people in different countries were counting to different moments and neither
 * to the show. Somebody arriving as it hit zero would have missed the start.
 *
 * An absent countdown costs nothing. A confident wrong one costs an audience,
 * and this is the number the ads point people at. So the date comes from the
 * Shows manager or the component does not render.
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

  // A target that is missing, or a string that is not a date, means there is no
  // confirmed start time. Both are the same answer: do not count to anything.
  const at = target ? new Date(target).getTime() : NaN;
  const known = !Number.isNaN(at);

  useEffect(() => {
    if (!known) return;

    setParts(partsUntil(at));
    setReady(true);
    const id = setInterval(() => setParts(partsUntil(at)), 1000);
    return () => clearInterval(id);
  }, [at, known]);

  // Nothing rather than a guess. See the note above: a countdown to an invented
  // time in the visitor's own zone is worse than no countdown at all.
  if (!known) return null;

  const cells: [string, number | null][] = [
    ["Next show", parts?.days ?? null],
    ["Hours", parts?.hours ?? null],
    ["Minutes", parts?.minutes ?? null],
    ["Seconds", parts?.seconds ?? null],
  ];

  const expired = ready && parts === null;

  return (
    <div className={cn("max-w-countdown", className)}>
      <div
        className={cn("grid grid-cols-4", onDark ? "divider-dark" : "divider")}
      >
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
              {expired
                ? "00"
                : value === null
                  ? "--"
                  : String(value).padStart(2, "0")}
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
