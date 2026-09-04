import { Prisma } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { env, mailEnabled } from "@/lib/env";
import { leadWhere, parseLeadFilter, type LeadFilter } from "@/lib/admin/leads";
import {
  renderTemplate,
  isTemplateKey,
  TEMPLATE_KEYS,
  type TemplateKey,
} from "@/lib/email-templates";
import {
  unsubscribeUrlFor,
  listUnsubscribeHeadersFor,
  unsubscribeUrl as legacyUnsubscribeUrl,
} from "@/lib/unsubscribe";

/**
 * The campaign sender.
 *
 * Three rules shape everything in this file.
 *
 * 1. Every CampaignSend row is created BEFORE the first message goes out. A send
 *    that dies halfway — process restart, deploy, OOM — resumes by picking up the
 *    rows still marked QUEUED. If rows were created as we went, a resume would
 *    re-scan the audience and mail the first half of the list twice.
 *
 * 2. Consent is checked at SEND time, not at audience-selection time. A campaign
 *    scheduled on Monday and sent on Friday must not mail somebody who
 *    unsubscribed on Wednesday. Suppression, marketingOptIn and unsubscribedAt
 *    are all re-read per batch.
 *
 * 3. Nothing silently pretends to have sent. `@/lib/mail` no-ops when
 *    RESEND_API_KEY is missing, which is right for a transactional confirmation
 *    — a contact form must not 500 because email is unconfigured. It is exactly
 *    wrong for a bulk campaign: the team would see "Sent to 4,812" and believe
 *    it. So a campaign send refuses to start without a provider.
 */

/* ------------------------------------------------------------- provider */

/**
 * Deliberately not `sendMail()` from @/lib/mail. Bulk marketing mail must carry
 * List-Unsubscribe / List-Unsubscribe-Post headers and a plain-text alternative,
 * and that helper accepts neither. The no-op-without-a-key contract it exists to
 * provide is honoured here instead by `assertMailReady()`, which refuses loudly
 * rather than quietly. Folding a `headers` / `text` passthrough into
 * `sendMail()` and calling it from here is the better long-term shape; that file
 * was outside this task's scope.
 */
let client: Resend | null = null;
function provider(): Resend | null {
  if (!mailEnabled) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export function assertMailReady() {
  if (!mailEnabled) {
    throw new Error(
      "Email is not configured. Set RESEND_API_KEY before sending a campaign — " +
        "a bulk send must never report success it did not achieve.",
    );
  }
}

/* ------------------------------------------------------------- tuning */

/** Resend's default account limit is 2 requests/second. Stay under it. */
export const MESSAGE_DELAY_MS = 550;
/** Rows pulled off the queue at a time. Small keeps a crash cheap to resume. */
export const BATCH_SIZE = 10;
/** Breather between batches so a burst never trips a provider throttle. */
export const BATCH_DELAY_MS = 1_000;
/** Hard ceiling on one campaign. A runaway filter cannot mail the whole table. */
export const MAX_AUDIENCE = 50_000;
/**
 * Messages one invocation will send before handing back.
 *
 * At roughly 1.5s a message a large list takes hours, which is far longer than
 * the job lock in jobs.ts holds. An overrunning job looks stale, a second tick
 * reclaims it, and the list gets mailed twice. Bounding the run instead means
 * every invocation finishes well inside the lock and the next tick picks up the
 * rows still marked QUEUED. At roughly a second a message this is about three
 * and a half minutes of work.
 */
export const MAX_MESSAGES_PER_RUN = 200;

const PAGE = 1_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Guards against two overlapping runs of the same campaign inside one process.
 * The Job table's lock covers the cross-process case; this covers the case where
 * an admin clicks "Send now" while the cron tick is already draining the job.
 */
const inFlight = new Set<string>();

/* ------------------------------------------------------------- audience */

/**
 * A Segment stores the same filter shape the leads table builds. Re-parsing it
 * through `parseLeadFilter` rather than trusting the stored JSON is not
 * ceremony: the allow-list is what stops a tampered or hand-edited
 * `Segment.filter` from reaching Prisma with keys nobody intended.
 */
export function coerceFilter(value: unknown): LeadFilter {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      record[k] = String(v);
    }
  }
  const filter = parseLeadFilter(record);
  delete filter.page;
  return filter;
}

/**
 * Consent is not a filter option, it is a precondition. Whatever the saved
 * filter says about `optIn`, a campaign only ever goes to people who opted in
 * and have not unsubscribed.
 */
export function audienceWhere(filter: LeadFilter): Prisma.LeadWhereInput {
  return {
    AND: [
      leadWhere({ ...filter, optIn: undefined }),
      { marketingOptIn: true, unsubscribedAt: null },
    ],
  };
}

export async function countAudience(filter: LeadFilter) {
  const [matching, mailable] = await Promise.all([
    prisma.lead.count({ where: leadWhere({ ...filter, optIn: undefined }) }),
    prisma.lead.count({ where: audienceWhere(filter) }),
  ]);
  return { matching, mailable };
}

type LoadedCampaign = Prisma.CampaignGetPayload<{
  include: { segment: true; show: true };
}>;

/** Segment wins when both are set, per the schema comment on Campaign.audience. */
export function campaignFilter(campaign: {
  segment?: { filter: Prisma.JsonValue } | null;
  audience?: Prisma.JsonValue | null;
}): LeadFilter {
  if (campaign.segment) return coerceFilter(campaign.segment.filter);
  return coerceFilter(campaign.audience ?? null);
}

export function loadCampaign(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: { segment: true, show: true },
  });
}

/* ------------------------------------------------------- personalisation */

/**
 * Token substitution belongs to @/lib/email-templates, not here.
 *
 * That module resolves every token, chooses the wording for a missing one
 * ("to be announced" rather than a blank line), strips an author's typo, and
 * formats a date in UTC with the zone named — this audience is global, so a bare
 * "8:00 PM" is wrong for almost everyone reading it. Re-implementing any of that
 * on this side would give two answers to the same question.
 *
 * What the sender owns is deciding which values go in.
 */

/**
 * `applyTokens` does not HTML-escape, and `firstName` arrives from a public
 * form. A name is never legitimately built out of angle brackets or quotes, so
 * they are dropped rather than entity-escaped — escaping would survive into the
 * plain-text alternative as a literal `&lt;`.
 */
function safeToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[<>"'`]/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * The template library formats a bare number as USD. A show priced in anything
 * else has to arrive preformatted, or the email states the wrong currency.
 */
function prizeToken(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string | number | null {
  if (amount === null || amount === undefined) return null;
  if (!currency || currency.toUpperCase() === "USD") return amount;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}

/** A renamed or hand-edited template key falls back rather than failing mid-send. */
export function resolveTemplateKey(key: string | null | undefined): TemplateKey {
  return isTemplateKey(key) ? key : TEMPLATE_KEYS[0];
}

export type RenderedEmail = { subject: string; html: string; text: string };

export function renderCampaign(
  campaign: LoadedCampaign,
  recipient: { firstName: string | null; unsubscribeLink: string },
): RenderedEmail {
  const site = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  const rendered = renderTemplate(resolveTemplateKey(campaign.templateKey), {
    firstName: safeToken(recipient.firstName),
    showTitle: safeToken(campaign.show?.title),
    // A Date, not a string: the library formats it in UTC with the zone named.
    // Null when the client has not confirmed a date — never a guess.
    showDate: campaign.show?.startsAt ?? null,
    // A separate moment from showDate, never a fallback for it. "Entries close"
    // and "the show starts" are different facts — Show carries both columns for
    // exactly that reason — and telling entrants the wrong closing time on a
    // prize competition is not a cosmetic error. Null means no confirmed
    // deadline, and the template says "closing soon" rather than inventing one.
    deadlineDate: campaign.show?.entryDeadline ?? null,
    prizeAmount: prizeToken(campaign.show?.prizeAmount, campaign.show?.currency),
    entryLink: `${site}/enter`,
    unsubscribeLink: recipient.unsubscribeLink,
    // The composer's own wording wins over the template's defaults.
    subject: campaign.subject,
    preheader: campaign.preheader,
    bodyHtml: campaign.bodyHtml || null,
  });

  return { subject: rendered.subject, html: rendered.html, text: rendered.text };
}

/* --------------------------------------------------------------- delivery */

type DeliverArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * RFC 8058 List-Unsubscribe pair, from listUnsubscribeHeaders(leadId). The URL
   * inside it has to be the POST endpoint rather than the confirmation page — a
   * One-Click header pointing at a GET page is a header Gmail cannot honour.
   */
  unsubscribeHeaders: Record<string, string>;
  /** Passed to the provider as an idempotency reference. */
  refId?: string;
};

async function deliver({
  to,
  subject,
  html,
  text,
  unsubscribeHeaders,
  refId,
}: DeliverArgs) {
  const resend = provider();
  if (!resend) throw new Error("Email provider is not configured");

  const headers: Record<string, string> = { ...unsubscribeHeaders };
  if (refId) headers["X-Entity-Ref-ID"] = refId;

  const { data, error } = await resend.emails.send({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
    text,
    headers,
  });

  if (error) throw new Error(error.message || "Provider rejected the message");
  return data?.id ?? null;
}

/* ---------------------------------------------------------- materialise */

/**
 * Create every CampaignSend row for a campaign, once.
 *
 * Deduplicated by lowercased email: `/api/subscribe` matches on `findFirst`, so
 * two Lead rows can legitimately hold the same address, and mailing it twice in
 * one campaign is how a list learns to mark you as spam.
 */
export async function materialiseRecipients(campaignId: string) {
  const campaign = await loadCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const where = audienceWhere(campaignFilter(campaign));

  const seen = new Set<string>();
  let created = 0;
  let cursor: string | undefined;

  for (;;) {
    const page: { id: string; email: string }[] = await prisma.lead.findMany({
      where,
      select: { id: true, email: true },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    cursor = page[page.length - 1].id;

    const rows: { campaignId: string; leadId: string }[] = [];
    for (const lead of page) {
      const key = lead.email.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({ campaignId, leadId: lead.id });
      if (seen.size >= MAX_AUDIENCE) break;
    }

    if (rows.length > 0) {
      const res = await prisma.campaignSend.createMany({ data: rows, skipDuplicates: true });
      created += res.count;
    }

    if (page.length < PAGE || seen.size >= MAX_AUDIENCE) break;
  }

  const total = await prisma.campaignSend.count({ where: { campaignId } });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { totalRecipients: total },
  });

  return { created, total };
}

/* ---------------------------------------------------------------- send */

export type SendSummary = {
  campaignId: string;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  /** Rows still QUEUED. Non-zero means the next tick continues from here. */
  remaining: number;
  resumed: boolean;
  /** Why this invocation stopped. Only "complete" finishes the campaign. */
  stopped: "complete" | "batch-limit" | "busy";
};

/** Skips are recorded on the row rather than deleted, so "why not?" has an answer. */
export const SKIP_PREFIX = "skipped:";

export function isSkip(error: string | null | undefined) {
  return Boolean(error && error.startsWith(SKIP_PREFIX));
}

/**
 * Drain a campaign's queue. Safe to call again after a crash: it only touches
 * rows still marked QUEUED, and the audience is frozen the first time it runs.
 */
export async function sendCampaign(campaignId: string): Promise<SendSummary> {
  assertMailReady();

  if (inFlight.has(campaignId)) {
    // Not an error. A tick that arrives while "Send now" is still draining the
    // same campaign should stand down quietly, not fail its job and burn a retry.
    const remaining = await prisma.campaignSend.count({
      where: { campaignId, status: "QUEUED" },
    });
    return {
      campaignId,
      recipients: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      remaining,
      resumed: true,
      stopped: "busy",
    };
  }
  inFlight.add(campaignId);

  try {
    const campaign = await loadCampaign(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!campaign.subject.trim()) throw new Error("Campaign has no subject line");

    const existing = await prisma.campaignSend.count({ where: { campaignId } });
    const resumed = existing > 0;

    // The audience is captured once, at the start of the first run. A resume
    // must not re-scan: leads added since then belong to the next campaign.
    if (!resumed) await materialiseRecipients(campaignId);

    const recipients = await prisma.campaignSend.count({ where: { campaignId } });
    if (recipients === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "FAILED", totalRecipients: 0 },
      });
      throw new Error("This audience has no mailable recipients");
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "SENDING" },
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let processed = 0;
    let hitLimit = false;
    const sentThisRun = new Set<string>();

    // Bounded so a row that somehow refuses to leave QUEUED cannot spin forever.
    const maxBatches = Math.ceil(recipients / BATCH_SIZE) + 2;

    for (let batchNo = 0; batchNo < maxBatches; batchNo++) {
      if (processed >= MAX_MESSAGES_PER_RUN) {
        hitLimit = true;
        break;
      }

      const batch = await prisma.campaignSend.findMany({
        where: { campaignId, status: "QUEUED" },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        include: {
          lead: {
            select: {
              id: true,
              email: true,
              firstName: true,
              marketingOptIn: true,
              unsubscribedAt: true,
            },
          },
        },
      });
      if (batch.length === 0) break;

      // Consent re-read per batch, not per campaign. This is the whole point of
      // checking at send time.
      const emails = batch.map((r) => r.lead.email.trim().toLowerCase());
      const suppressed = new Map(
        (
          await prisma.suppression.findMany({
            where: { email: { in: emails } },
            select: { email: true, reason: true },
          })
        ).map((s) => [s.email.toLowerCase(), s.reason]),
      );

      for (const row of batch) {
        const email = row.lead.email.trim().toLowerCase();

        let skipReason: string | null = null;
        if (!email || !email.includes("@")) skipReason = "no usable email address";
        else if (suppressed.has(email)) skipReason = `suppressed (${suppressed.get(email)})`;
        else if (!row.lead.marketingOptIn) skipReason = "no marketing consent";
        else if (row.lead.unsubscribedAt) skipReason = "unsubscribed";
        else if (sentThisRun.has(email)) skipReason = "duplicate address in this campaign";

        if (skipReason) {
          await prisma.campaignSend.update({
            where: { id: row.id },
            data: { status: "FAILED", error: `${SKIP_PREFIX} ${skipReason}` },
          });
          skipped += 1;
          processed += 1;
          continue;
        }

        try {
          // Durable, stored token — not the deprecated HMAC helper. An HMAC link
          // stops verifying the moment AUTH_SECRET is rotated, which would leave
          // every already-delivered email with a dead unsubscribe link. Both
          // calls resolve the same stored token, minting it once on first send.
          const [unsubscribeLink, unsubscribeHeaders] = await Promise.all([
            unsubscribeUrlFor(row.lead.id),
            listUnsubscribeHeadersFor(row.lead.id),
          ]);

          const rendered = renderCampaign(campaign, {
            firstName: row.lead.firstName,
            unsubscribeLink,
          });

          const providerId = await deliver({
            to: row.lead.email,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            unsubscribeHeaders,
            refId: row.id,
          });

          await prisma.campaignSend.update({
            where: { id: row.id },
            data: {
              status: "SENT",
              providerId,
              sentAt: new Date(),
              error: null,
            },
          });
          sentThisRun.add(email);
          sent += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await prisma.campaignSend.update({
            where: { id: row.id },
            data: { status: "FAILED", error: message.slice(0, 500) },
          });
          failed += 1;
        }

        processed += 1;
        await sleep(MESSAGE_DELAY_MS);
      }

      // Counters move as the send progresses so the dashboard is live, not a
      // reveal at the end.
      await refreshCampaignCounters(campaignId);
      await sleep(BATCH_DELAY_MS);
    }

    const remaining = await prisma.campaignSend.count({
      where: { campaignId, status: "QUEUED" },
    });
    const counters = await refreshCampaignCounters(campaignId);

    if (remaining === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: counters.sent === 0 ? "FAILED" : "SENT",
          sentAt: new Date(),
        },
      });
    }
    // Otherwise the campaign stays SENDING with rows still QUEUED, and
    // promoteDueCampaigns in jobs.ts queues the continuation.

    return {
      campaignId,
      recipients,
      sent,
      failed,
      skipped,
      remaining,
      resumed,
      stopped: remaining === 0 ? "complete" : hitLimit ? "batch-limit" : "complete",
    };
  } finally {
    inFlight.delete(campaignId);
  }
}

/**
 * Recompute the denormalised Campaign counters from CampaignSend rows.
 *
 * The counters are a fast read, never the source of truth — webhooks arrive out
 * of order and a crashed send leaves them stale, so they are rebuilt rather than
 * only incremented.
 */
export async function refreshCampaignCounters(campaignId: string) {
  const [grouped, delivered, opened, clicked, bounced, skipped] = await Promise.all([
    prisma.campaignSend.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { _all: true },
    }),
    prisma.campaignSend.count({ where: { campaignId, deliveredAt: { not: null } } }),
    prisma.campaignSend.count({ where: { campaignId, openedAt: { not: null } } }),
    prisma.campaignSend.count({ where: { campaignId, clickedAt: { not: null } } }),
    prisma.campaignSend.count({ where: { campaignId, status: "BOUNCED" } }),
    prisma.campaignSend.count({
      where: { campaignId, status: "FAILED", error: { startsWith: SKIP_PREFIX } },
    }),
  ]);

  const by = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;

  // A row that later opened or clicked was, necessarily, sent.
  const sent = by("SENT") + by("OPENED") + by("CLICKED") + by("BOUNCED");
  const failed = by("FAILED");
  const total = grouped.reduce((n, g) => n + g._count._all, 0);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      totalRecipients: total,
      totalSent: sent,
      totalFailed: failed,
      totalDelivered: delivered,
      totalOpened: opened,
      totalClicked: clicked,
      totalBounced: bounced,
    },
  });

  return { total, sent, failed, delivered, opened, clicked, bounced, skipped };
}

/* ----------------------------------------------------------------- test */

/**
 * A token-shaped URL the unsubscribe route will reject. A preview and a test
 * must lay out exactly as a live send does, links included, without being able
 * to unsubscribe anybody who clicks one.
 */
function previewUnsubscribeUrl() {
  const site = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return `${site}/unsubscribe/preview-token-not-valid`;
}

/**
 * One message to one address, rendered exactly as the real send would render it.
 * A test that takes a different code path proves nothing.
 */
export async function sendCampaignTest(campaignId: string, to: string) {
  assertMailReady();

  const campaign = await loadCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const address = to.trim().toLowerCase();

  // If the tester is already on the list, use their real link so the unsubscribe
  // flow can be tested end to end. Otherwise an inert one — a test must not mint
  // a live token for somebody who never consented.
  const lead = await prisma.lead.findFirst({
    where: { email: address },
    select: { id: true, firstName: true },
  });

  const rendered = renderCampaign(campaign, {
    firstName: lead?.firstName ?? "Sample",
    unsubscribeLink: lead ? legacyUnsubscribeUrl(lead.id) : previewUnsubscribeUrl(),
  });

  await deliver({
    to: address,
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
    // A tester who is not on the list has no token to mint, so the header is
    // omitted rather than forged. One test message is not bulk mail.
    unsubscribeHeaders: {},
  });

  return { to: address, subject: rendered.subject };
}

/* -------------------------------------------------------------- preview */

/** Rendered with sample data for the composer. Never touches the provider. */
export function renderCampaignPreview(campaign: LoadedCampaign): RenderedEmail {
  return renderCampaign(campaign, {
    firstName: "Alex",
    unsubscribeLink: previewUnsubscribeUrl(),
  });
}
