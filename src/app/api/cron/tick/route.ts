import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { tick, MAX_JOBS_PER_TICK } from "@/lib/campaigns/jobs";

/**
 * The heartbeat. A systemd timer (or PM2 cron) hits this once a minute; it
 * promotes any campaign whose `scheduledFor` has arrived and drains the Job
 * table. See docs/BUILD-PLAN.md Phase 10.8 for the timer unit.
 *
 * This endpoint is public — it is not behind the admin middleware matcher and it
 * cannot be, because a timer has no session cookie. `CRON_SECRET` is the only
 * thing between the internet and "send every scheduled campaign now", so:
 *
 *   - the comparison is constant-time over fixed-length SHA-256 digests. A plain
 *     `===` leaks the secret one byte at a time to anyone willing to measure a
 *     few thousand requests, and comparing the raw strings would either throw on
 *     a length mismatch (itself a signal) or let an attacker size the work.
 *   - a missing CRON_SECRET returns 503, never 200. "Unconfigured" must fail
 *     closed; an open scheduler is worse than a stopped one.
 *   - failed attempts are counted per IP and the count is *enforced*: once the
 *     bucket is spent the request is refused with 429 before anything else
 *     happens, so the secret cannot be guessed at speed.
 *
 * A tick that picks up a campaign send holds the request open for minutes —
 * sending is rate limited, not slow — so the timer must allow for it. Something
 * like `curl --max-time 300 -H "Authorization: Bearer $CRON_SECRET" ...` once a
 * minute. The work is bounded by TICK_BUDGET_MS either way, and a request the
 * timer gives up on still leaves the queue consistent: `claimNextJob` takes each
 * job with a conditional `updateMany` and only runs it when that update reports
 * exactly one row changed, so two overlapping ticks can never claim the same
 * job, and every send resumes from the rows still marked QUEUED.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;

/**
 * One timer calls this, not people. A legitimate caller never fails auth, so a
 * handful of rejects a minute from one address is already a brute-force attempt
 * and everything after it is refused for the rest of the window.
 */
const FAILED_ATTEMPTS_PER_WINDOW = 5;

/**
 * Accepted ticks. Ticks overlap by design (a send can run for minutes while the
 * next minute fires), so this has to leave room for a few in flight at once
 * without becoming a free replay budget.
 */
const ACCEPTED_TICKS_PER_WINDOW = 6;

/**
 * Client address, taken the way it survives our own Nginx.
 *
 * `$proxy_add_x_forwarded_for` *appends* the real peer to whatever the client
 * sent, so the FIRST element of x-forwarded-for is attacker-controlled — a
 * forged one would give every request its own rate-limit bucket and defeat the
 * limiter entirely. The last element is the one Nginx wrote. `x-real-ip` is set
 * by the same proxy config to exactly that value, so prefer it when present.
 *
 * NOTE: src/lib/chat/guard.ts grows its own copy of this for the chat routes.
 * Deliberately duplicated rather than imported — the cron heartbeat should not
 * depend on the chatbot module — but the two must stay in step if the proxy
 * config ever changes.
 */
function clientIp(req: NextRequest): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return chain[chain.length - 1] ?? "unknown";
}

function authorised(req: NextRequest): boolean {
  const expected = env.CRON_SECRET;
  if (!expected) return false;

  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  // `x-cron-secret` and `?key=` are for timers that cannot set an Authorization
  // header. The query form ends up in access logs, so the header is preferred.
  const provided =
    bearer ||
    req.headers.get("x-cron-secret")?.trim() ||
    req.nextUrl.searchParams.get("key")?.trim() ||
    "";

  if (!provided) return false;

  // timingSafeEqual throws on a length mismatch, and throwing is itself a timing
  // signal that leaks the length of the secret. Hashing first makes both sides
  // exactly 32 bytes, so the comparison is always constant-time, never throws,
  // and the work does not scale with an attacker-supplied string. Equal digests
  // imply equal inputs, so no separate length check is needed.
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function retryAfterSeconds(limit: ReturnType<typeof rateLimit>): number {
  const ms = "retryAfter" in limit ? limit.retryAfter : undefined;
  return Math.max(1, Math.ceil((ms ?? WINDOW_MS) / 1000));
}

function tooManyRequests(limit: ReturnType<typeof rateLimit>) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(retryAfterSeconds(limit)),
      },
    },
  );
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Scheduler is not configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  if (!authorised(req)) {
    // The return value is the whole point: counting rejects without acting on
    // them is not a rate limit, it is a counter. Once the bucket is spent every
    // further guess is refused here, before any further work.
    const attempt = rateLimit(`cron-fail:${ip}`, FAILED_ATTEMPTS_PER_WINDOW, WINDOW_MS);
    if (!attempt.ok) return tooManyRequests(attempt);

    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const accepted = rateLimit(`cron-ok:${ip}`, ACCEPTED_TICKS_PER_WINDOW, WINDOW_MS);
  if (!accepted.ok) return tooManyRequests(accepted);

  const startedAt = Date.now();

  try {
    const result = await tick(MAX_JOBS_PER_TICK);

    return NextResponse.json(
      {
        ok: true,
        ms: Date.now() - startedAt,
        promoted: result.promoted,
        ran: result.ran.length,
        pending: result.pending,
        // Enough detail for `journalctl` to explain a failed send without
        // opening the dashboard.
        jobs: result.ran.map((j) => ({
          kind: j.kind,
          ok: j.ok,
          attempts: j.attempts,
          willRetry: j.willRetry,
          detail: j.detail,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    // A tick that throws must not take the timer down silently.
    console.error("[cron] tick failed", err);
    return NextResponse.json(
      { ok: false, error: "Tick failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
