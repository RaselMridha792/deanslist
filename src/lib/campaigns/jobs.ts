import { Prisma, type Job } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { coerceFilter, countAudience, sendCampaign } from "@/lib/campaigns/send";

/**
 * The job runner.
 *
 * `Campaign.scheduledFor` has existed since the first schema and nothing ever
 * executed it — a scheduled campaign simply sat in the table forever. The same
 * gap killed the automated pre-show reminders that the brief calls the
 * highest-value feature of the whole build.
 *
 * This is the smallest thing that fixes it on a single VPS with no Redis: a
 * `Job` table, an atomic claim, and a timer hitting `GET /api/cron/tick`.
 *
 * The claim is the part that matters. Two overlapping ticks — a slow send still
 * running when the next minute fires — must never run the same job twice, and a
 * duplicated `send_campaign` means the list gets mailed twice.
 */

export const JOB_KINDS = ["send_campaign", "show_reminder", "recount_segment"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

/** A claim older than this is assumed dead (process killed mid-job) and reclaimable. */
export const LOCK_TIMEOUT_MS = 30 * 60 * 1000;

/** Backoff per attempt. A provider outage should not burn all three tries in a minute. */
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];

/** How many jobs one tick will drain. Keeps a single request bounded. */
export const MAX_JOBS_PER_TICK = 5;

/**
 * Wall-clock budget for one tick. A send job runs for minutes by design (it is
 * rate limited, not slow), so without a budget five queued sends would hold one
 * HTTP request open for twenty. The tick stops claiming new work once the budget
 * is spent; whatever is left is claimed by the next one.
 */
export const TICK_BUDGET_MS = 4 * 60 * 1000;

/* ------------------------------------------------------------- enqueue */

export async function enqueueJob(args: {
  kind: JobKind;
  payload: Prisma.InputJsonValue;
  runAfter?: Date;
  maxAttempts?: number;
}) {
  return prisma.job.create({
    data: {
      kind: args.kind,
      payload: args.payload,
      runAfter: args.runAfter ?? new Date(),
      maxAttempts: args.maxAttempts ?? 3,
    },
  });
}

/**
 * Enqueue a send for a campaign unless one is already waiting or running.
 * Without this check, "Send now" clicked twice, or a scheduled campaign the
 * backstop also promotes, would queue two jobs for the same list.
 */
export async function enqueueCampaignSend(
  campaignId: string,
  runAfter?: Date,
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.job.findFirst({
    where: {
      kind: "send_campaign",
      status: { in: ["PENDING", "RUNNING"] },
      payload: { path: ["campaignId"], equals: campaignId },
    },
    select: { id: true, status: true },
  });

  if (existing) {
    // Rescheduling has to move the job it already queued. Returning the old one
    // untouched would fire the campaign at the time it was first scheduled for,
    // which is the kind of bug nobody notices until an email arrives at 3am.
    if (runAfter && existing.status === "PENDING") {
      await prisma.job.updateMany({
        where: { id: existing.id, status: "PENDING" },
        data: { runAfter },
      });
    }
    return { id: existing.id, created: false };
  }

  const job = await enqueueJob({ kind: "send_campaign", payload: { campaignId }, runAfter });
  return { id: job.id, created: true };
}

/* --------------------------------------------------------------- claim */

/**
 * Claim one job, atomically.
 *
 * `updateMany` returns the number of rows it actually changed, and Postgres
 * re-evaluates the WHERE clause after taking the row lock. So of two ticks
 * racing for the same row, exactly one sees `count === 1`. A `findFirst` then
 * `update` would let both win.
 */
export async function claimNextJob(): Promise<Job | null> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  const candidates = await prisma.job.findMany({
    where: {
      OR: [
        { status: "PENDING", runAfter: { lte: now } },
        { status: "RUNNING", lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ runAfter: "asc" }, { createdAt: "asc" }],
    take: 10,
    select: { id: true },
  });

  for (const candidate of candidates) {
    const claimed = await prisma.job.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: "PENDING", runAfter: { lte: now } },
          { status: "RUNNING", lockedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: "RUNNING",
        lockedAt: now,
        startedAt: now,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 1) {
      return prisma.job.findUnique({ where: { id: candidate.id } });
    }
  }

  return null;
}

/* ------------------------------------------------------------ handlers */

type Handler = (payload: Record<string, unknown>, job: Job) => Promise<string>;

const handlers: Record<JobKind, Handler> = {
  send_campaign: async (payload) => {
    const campaignId = str(payload.campaignId);
    if (!campaignId) throw new Error("send_campaign: campaignId missing");

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true, name: true },
    });
    if (!campaign) throw new Error("send_campaign: campaign not found");

    // A campaign someone reverted to DRAFT after scheduling it must not fire.
    if (campaign.status === "DRAFT") return `skipped, "${campaign.name}" is back in draft`;

    const summary = await sendCampaign(campaignId);
    if (summary.stopped === "busy") {
      return `${campaign.name}: already draining in this process, stood down`;
    }
    const tail =
      summary.remaining > 0
        ? `, ${summary.remaining} still queued for the next tick`
        : ", complete";
    return `${campaign.name}: ${summary.sent} sent, ${summary.failed} failed, ${summary.skipped} skipped${tail}`;
  },

  /**
   * Pre-show reminder. Either fires an already-composed campaign, or builds one
   * from the reminder template for a show.
   */
  show_reminder: async (payload) => {
    const existingCampaignId = str(payload.campaignId);
    if (existingCampaignId) {
      await enqueueCampaignSend(existingCampaignId);
      return `queued existing campaign ${existingCampaignId}`;
    }

    const showId = str(payload.showId);
    if (!showId) throw new Error("show_reminder: showId or campaignId required");

    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) throw new Error("show_reminder: show not found");
    if (show.status === "ARCHIVED" || show.status === "DRAFT") {
      return `skipped, ${show.title} is ${show.status.toLowerCase()}`;
    }

    const segmentId = str(payload.segmentId);
    const templateKey = str(payload.templateKey) ?? "reminder";

    const campaign = await prisma.campaign.create({
      data: {
        name: `Reminder — ${show.title} — ${new Date().toISOString().slice(0, 10)}`,
        // Tokens are resolved at render time against this campaign's show.
        subject: `{{showTitle}} is coming up`,
        preheader: "Set a reminder so you do not miss it.",
        bodyHtml: "",
        templateKey,
        showId: show.id,
        segmentId: segmentId ?? null,
        // An empty filter means "everyone who consented". A saved segment, when
        // one is given, wins over this at render time.
        audience: {},
        status: "SCHEDULED",
        scheduledFor: new Date(),
      },
      select: { id: true, name: true },
    });

    await enqueueCampaignSend(campaign.id);
    return `created and queued "${campaign.name}"`;
  },

  /**
   * Refresh a segment's cached recipient count. Cheap, and it keeps the number
   * the composer shows from going stale between sends.
   */
  recount_segment: async (payload) => {
    const segmentId = str(payload.segmentId);
    const segments = segmentId
      ? await prisma.segment.findMany({ where: { id: segmentId } })
      : await prisma.segment.findMany();

    for (const segment of segments) {
      const { mailable } = await countAudience(coerceFilter(segment.filter));
      await prisma.segment.update({
        where: { id: segment.id },
        data: { lastCount: mailable, lastCountAt: new Date() },
      });
    }

    return `recounted ${segments.length} segment${segments.length === 1 ? "" : "s"}`;
  },
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/* ----------------------------------------------------------------- run */

export type JobOutcome = {
  id: string;
  kind: string;
  ok: boolean;
  detail: string;
  attempts: number;
  willRetry: boolean;
};

export async function runJob(job: Job): Promise<JobOutcome> {
  const handler = handlers[job.kind as JobKind];

  if (!handler) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        lastError: `Unknown job kind "${job.kind}"`,
        finishedAt: new Date(),
        lockedAt: null,
      },
    });
    return {
      id: job.id,
      kind: job.kind,
      ok: false,
      detail: "unknown kind",
      attempts: job.attempts,
      willRetry: false,
    };
  }

  const payload =
    job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
      ? (job.payload as Record<string, unknown>)
      : {};

  try {
    const detail = await handler(payload, job);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "DONE", finishedAt: new Date(), lockedAt: null, lastError: null },
    });
    return { id: job.id, kind: job.kind, ok: true, detail, attempts: job.attempts, willRetry: false };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000);
    const exhausted = job.attempts >= job.maxAttempts;
    const backoff = BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)] ?? 60_000;

    await prisma.job.update({
      where: { id: job.id },
      data: exhausted
        ? { status: "FAILED", lastError: message, finishedAt: new Date(), lockedAt: null }
        : {
            status: "PENDING",
            lastError: message,
            lockedAt: null,
            runAfter: new Date(Date.now() + backoff),
          },
    });

    // A send whose job has run out of attempts must not stay SCHEDULED: the
    // next tick's promoteDueCampaigns would enqueue a fresh job, which would
    // fail the same way, forever. Marking it FAILED stops the loop and still
    // leaves "Send now" available once somebody has fixed the cause.
    if (exhausted && job.kind === "send_campaign") {
      const raw = job.payload as unknown as Record<string, unknown> | null;
      const campaignId = str(raw?.campaignId);
      if (campaignId) {
        await prisma.campaign.updateMany({
          where: { id: campaignId, status: { in: ["SCHEDULED", "SENDING"] } },
          data: { status: "FAILED" },
        });
      }
    }

    return {
      id: job.id,
      kind: job.kind,
      ok: false,
      detail: message,
      attempts: job.attempts,
      willRetry: !exhausted,
    };
  }
}

export async function runJobById(id: string): Promise<JobOutcome | null> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  const claimed = await prisma.job.updateMany({
    where: {
      id,
      OR: [{ status: "PENDING" }, { status: "RUNNING", lockedAt: { lt: staleBefore } }],
    },
    data: { status: "RUNNING", lockedAt: now, startedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return null;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return null;
  return runJob(job);
}

/**
 * Two jobs in one pass.
 *
 * Due campaigns: a backstop for `Campaign.scheduledFor`. Scheduling enqueues a
 * job directly, so this only catches campaigns scheduled before the runner
 * existed, or a job row lost to a manual database edit.
 *
 * Interrupted sends: the important half. A send stops at MAX_MESSAGES_PER_RUN
 * so it never outlives its lock, and a crashed process leaves rows QUEUED too.
 * Either way the campaign sits in SENDING with work left, and this is what
 * queues the continuation. Without it a large list would stop partway through
 * and nothing would ever say so.
 */
export async function promoteDueCampaigns(): Promise<number> {
  const [due, interrupted] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
      select: { id: true },
      take: 20,
    }),
    prisma.campaign.findMany({
      where: { status: "SENDING", sends: { some: { status: "QUEUED" } } },
      select: { id: true },
      take: 20,
    }),
  ]);

  let promoted = 0;
  const seen = new Set<string>();
  for (const campaign of [...due, ...interrupted]) {
    if (seen.has(campaign.id)) continue;
    seen.add(campaign.id);
    const job = await enqueueCampaignSend(campaign.id);
    if (job.created) promoted += 1;
  }
  return promoted;
}

export type TickResult = {
  promoted: number;
  ran: JobOutcome[];
  pending: number;
};

export async function tick(limit = MAX_JOBS_PER_TICK): Promise<TickResult> {
  const startedAt = Date.now();
  const promoted = await promoteDueCampaigns();

  const ran: JobOutcome[] = [];
  for (let i = 0; i < limit; i++) {
    if (Date.now() - startedAt > TICK_BUDGET_MS) break;
    const job = await claimNextJob();
    if (!job) break;
    ran.push(await runJob(job));
  }

  const pending = await prisma.job.count({
    where: { status: "PENDING", runAfter: { lte: new Date() } },
  });

  return { promoted, ran, pending };
}

/* -------------------------------------------------------- reminder plan */

/**
 * Schedule the reminder sequence for a show: one a day out, one an hour out.
 * Anything already in the past is skipped rather than fired late — a "starting
 * in one hour" email sent after the show has aired is worse than no email.
 */
export async function scheduleShowReminders(
  showId: string,
  startsAt: Date,
  segmentId?: string | null,
) {
  const offsets = [
    { hours: 24, label: "24h" },
    { hours: 1, label: "1h" },
  ];

  const created: string[] = [];
  for (const offset of offsets) {
    const runAfter = new Date(startsAt.getTime() - offset.hours * 60 * 60 * 1000);
    if (runAfter.getTime() <= Date.now()) continue;

    await enqueueJob({
      kind: "show_reminder",
      payload: { showId, segmentId: segmentId ?? null, templateKey: "reminder" },
      runAfter,
    });
    created.push(offset.label);
  }
  return created;
}

/** Used by the segments screen to show a count without waiting on the job. */
export async function recountSegmentNow(segmentId: string) {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!segment) return null;
  const { mailable, matching } = await countAudience(coerceFilter(segment.filter));
  await prisma.segment.update({
    where: { id: segmentId },
    data: { lastCount: mailable, lastCountAt: new Date() },
  });
  return { mailable, matching };
}
