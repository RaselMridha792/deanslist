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

type Props = {
  /** ISO 8601 string with an offset, e.g. 2026-09-11T20:00:00-04:00. */
  target: string;
  label?: string;
  expiredLabel?: string;
  showSeconds?: boolean;
  className?: string;
};

/**
 * Deadline counter.
 *
 * Two things this has to get right and most implementations do not:
 *
 * 1. Hydration. The server and the browser evaluate Date.now() at different
 *    moments, so rendering the number during SSR guarantees a mismatch. The first
 *    client render therefore reproduces the server's placeholder exactly, and the
 *    real figures only appear from the effect onward.
 *
 * 2. Expiry. Once the deadline passes it renders the expired label rather than
 *    counting into negatives — the old site's stat band is a standing reminder of
 *    what a half-rendered number costs.
 *
 * The target must carry a UTC offset. A bare "2026-09-11T20:00:00" is read as
 * local time, so a visitor in Dhaka and one in Charleston would see different
 * deadlines for the same show.
 */
export function Countdown({
  target,
  label,
  expiredLabel = "Entries closed",
  showSeconds = false,
  className,
}: Props) {
  const targetMs = new Date(target).getTime();
  const [parts, setParts] = useState<Parts | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Number.isNaN(targetMs)) return;

    setParts(partsUntil(targetMs));
    setReady(true);

    // Tick every second only when seconds are shown; otherwise once a minute is
    // plenty and keeps a background tab from waking constantly.
    const id = setInterval(
      () => setParts(partsUntil(targetMs)),
      showSeconds ? 1000 : 30_000,
    );
    return () => clearInterval(id);
  }, [targetMs, showSeconds]);

  if (Number.isNaN(targetMs)) return null;

  const units: Array<[string, number]> = parts
    ? showSeconds
      ? [
          ["Days", parts.days],
          ["Hrs", parts.hours],
          ["Min", parts.minutes],
          ["Sec", parts.seconds],
        ]
      : [
          ["Days", parts.days],
          ["Hours", parts.hours],
          ["Minutes", parts.minutes],
        ]
    : [];

  // Under 24 hours the deadline becomes urgent, which is the one place red is
  // allowed to appear outside a live badge.
  const urgent = parts !== null && parts.days === 0;

  return (
    <div className={cn("inline-flex flex-col gap-2", className)}>
      {label && <p className="eyebrow">{label}</p>}

      {ready && parts === null ? (
        <p className="font-display text-display-sm uppercase text-chalk-muted">{expiredLabel}</p>
      ) : (
        <div className="flex items-start gap-3 sm:gap-5" aria-live="polite">
          {(parts ? units : [["Days", 0], ["Hours", 0], ["Minutes", 0]] as Array<[string, number]>).map(
            ([unit, value]) => (
              <div key={unit} className="text-center">
                <p
                  className={cn(
                    "font-display text-4xl leading-none tabular-nums sm:text-5xl",
                    !parts && "text-chalk-ghost",
                    parts && urgent ? "text-live" : parts ? "text-metal" : "",
                  )}
                >
                  {/* Before the effect runs this renders as dashes, identical on
                      server and client, so hydration stays clean. */}
                  {parts ? String(value).padStart(2, "0") : "--"}
                </p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-chalk-faint">
                  {unit}
                </p>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
