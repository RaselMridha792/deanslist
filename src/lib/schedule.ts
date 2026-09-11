import type { WeeklySlot } from "@/content/site";

/**
 * When a show next starts, as an ISO string, or null when nobody has said.
 *
 * Two sources, in this order:
 *
 *   a date set in the Shows manager, while it is still ahead or on air;
 *   otherwise the show's weekly slot. For Drop That Mike the client confirmed
 *   that slot on 2026-09-11: every Tuesday at 7pm Eastern.
 *
 * The slot is worked out in the SHOW'S time zone, never the visitor's. A viewer
 * in Lagos and one in Los Angeles count down to the same instant, and a daylight
 * saving change moves the UTC moment rather than the 7pm.
 *
 * "Still ahead" includes the first 90 minutes after a start. A countdown that
 * reaches zero then reads 00 while the show is on, instead of jumping to next
 * week in the middle of the broadcast.
 */
const ON_AIR_MS = 90 * 60_000;

export function nextStart(
  show: { startsAt: string | null; weekly?: WeeklySlot } | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!show) return null;
  if (show.startsAt) {
    const at = new Date(show.startsAt).getTime();
    if (!Number.isNaN(at) && at + ON_AIR_MS > now.getTime()) return show.startsAt;
  }
  return show.weekly ? nextWeeklyStart(show.weekly, now).toISOString() : null;
}

/** The next start of a weekly slot that is not already over. */
export function nextWeeklyStart(slot: WeeklySlot, now: Date = new Date()): Date {
  const today = wallClock(now, slot.timeZone);
  // Two weeks always contain the weekday twice; the second covers a start
  // today that has already finished.
  for (let i = 0; i < 15; i++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    if (day.getUTCDay() !== slot.weekday) continue;
    const start = zonedToUtc(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      slot.hour,
      slot.minute,
      slot.timeZone,
    );
    if (start.getTime() + ON_AIR_MS > now.getTime()) return start;
  }
  throw new Error(`Weekday ${slot.weekday} is not a day of the week.`);
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** What a clock on the wall in `timeZone` reads at `date`. */
function wallClock(date: Date, timeZone: string): WallClock {
  const out: Record<string, number> = {};
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  for (const part of format.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return out as WallClock;
}

/** How far `timeZone` is ahead of UTC at `date`, in milliseconds. */
function offsetMs(date: Date, timeZone: string): number {
  const w = wallClock(date, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant at which the wall clock in `timeZone` reads the given time. */
function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // Checked again at the answer: the two offsets differ only when a daylight
  // saving change falls between the guess and the real instant.
  return new Date(guess - offsetMs(new Date(first), timeZone));
}
