"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";
import { coerceFilter, countAudience, sendCampaignTest } from "@/lib/campaigns/send";
import { enqueueCampaignSend, runJobById, recountSegmentNow } from "@/lib/campaigns/jobs";
import type { ActionResult } from "@/components/admin/crud";

/**
 * Mutations for segments and campaigns.
 *
 * Every one calls requireRole() itself. A server action is a public HTTP
 * endpoint with a generated name; being reachable only from a page behind a
 * login is not authorisation, and middleware has proven bypassable
 * (CVE-2025-29927). Every one also writes an AuditLog row — "who sent the email
 * to nine thousand people" has to have an answer.
 *
 * EDITOR composes and sends. That matches the role matrix in src/lib/auth.ts:
 * REVIEWER triages leads and nothing else.
 */

async function audit(
  user: SessionUser,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userEmail: user.email,
      action,
      entityType,
      entityId,
      before: before as never,
      after: after as never,
    },
  });
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

const text = (v: FormDataEntryValue | null) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/**
 * Pull a lead filter out of a form.
 *
 * The fields are named exactly as the leads table names its URL params, so
 * "save this view as a segment" is a link that carries the query string across
 * with no translation layer to drift out of sync. Everything is re-validated
 * through parseLeadFilter inside coerceFilter, so an unknown key never reaches
 * Prisma.
 */
function filterFromForm(data: FormData): Prisma.InputJsonObject {
  const keys = ["q", "type", "status", "source", "showId", "country", "tag", "from", "to"];
  const raw: Record<string, string> = {};
  for (const key of keys) {
    const value = text(data.get(key));
    if (value) raw[key] = value;
  }

  // A campaign form already owns `showId` — the show the email is *about*. Its
  // audience filter (the show a contact entered) therefore arrives under
  // `audienceShowId`, and when that control is present it is authoritative.
  // Without this the composer would silently filter the audience by the show it
  // was announcing, which reads correct and is not.
  if (data.has("audienceShowId")) {
    delete raw.showId;
    const value = text(data.get("audienceShowId"));
    if (value) raw.showId = value;
  }

  // Round-trip through the parser so what we store is what the table would use.
  return coerceFilter(raw) as Prisma.InputJsonObject;
}

/* ================================================================ segments */

const segmentSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2, "Give the segment a name").max(80),
  description: z.string().max(500).optional(),
});

export async function saveSegment(data: FormData): Promise<ActionResult> {
  const user = await requireRole("EDITOR");

  const parsed = segmentSchema.safeParse({
    id: text(data.get("id")),
    name: text(data.get("name")),
    description: text(data.get("description")),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid segment");

  const filter = filterFromForm(data);

  // An empty filter is "everyone who consented". That is a legitimate segment,
  // but it is also what an accidental save produces, so it has to be deliberate.
  if (Object.keys(filter).length === 0 && data.get("allowEmpty") !== "on") {
    return fail(
      "This segment has no filters, which means every consented contact. Tick “this is the whole list” if that is intended.",
    );
  }

  try {
    if (parsed.data.id) {
      const before = await prisma.segment.findUnique({ where: { id: parsed.data.id } });
      if (!before) return fail("Segment not found");

      const updated = await prisma.segment.update({
        where: { id: parsed.data.id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          filter,
          // The cached count belongs to the old filter; clear rather than lie.
          lastCount: null,
          lastCountAt: null,
        },
      });

      await audit(user, "segment.update", "Segment", updated.id, before, updated);
      await recountSegmentNow(updated.id);
      revalidatePath("/admin/segments");
      return { ok: true, id: updated.id };
    }

    const created = await prisma.segment.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        filter,
      },
    });

    await audit(user, "segment.create", "Segment", created.id, null, created);
    await recountSegmentNow(created.id);
    revalidatePath("/admin/segments");
    return { ok: true, id: created.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("A segment with that name already exists");
    }
    return fail(err instanceof Error ? err.message : "Could not save the segment");
  }
}

export async function deleteSegment(input: unknown): Promise<ActionResult> {
  const user = await requireRole("EDITOR");
  const parsed = z.string().min(1).safeParse(input);
  if (!parsed.success) return fail("Invalid request");

  const segment = await prisma.segment.findUnique({
    where: { id: parsed.data },
    include: { _count: { select: { campaigns: true } } },
  });
  if (!segment) return fail("Segment not found");

  // Campaign.segmentId is SetNull, so deleting would silently widen a scheduled
  // campaign's audience to "everyone". Refuse instead.
  if (segment._count.campaigns > 0) {
    return fail(
      `${segment._count.campaigns} campaign(s) still target this segment. Repoint them first.`,
    );
  }

  await prisma.segment.delete({ where: { id: segment.id } });
  await audit(user, "segment.delete", "Segment", segment.id, segment, null);
  revalidatePath("/admin/segments");
  return { ok: true };
}

export async function recountSegment(input: unknown): Promise<ActionResult> {
  await requireRole("EDITOR");
  const parsed = z.string().min(1).safeParse(input);
  if (!parsed.success) return fail("Invalid request");

  const result = await recountSegmentNow(parsed.data);
  if (!result) return fail("Segment not found");

  revalidatePath("/admin/segments");
  return { ok: true };
}

/* =============================================================== campaigns */

const campaignSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2, "Give the campaign a name").max(120),
  subject: z.string().min(2, "A subject line is required").max(200),
  preheader: z.string().max(200).optional(),
  templateKey: z.string().min(1).max(60).optional(),
  showId: z.string().min(1).optional(),
  segmentId: z.string().min(1).optional(),
  bodyHtml: z.string().max(100_000).optional(),
});

function campaignFromForm(data: FormData) {
  return campaignSchema.safeParse({
    id: text(data.get("id")),
    name: text(data.get("name")),
    subject: text(data.get("subject")),
    preheader: text(data.get("preheader")),
    templateKey: text(data.get("templateKey")),
    showId: text(data.get("showId")),
    segmentId: text(data.get("segmentId")),
    bodyHtml: typeof data.get("bodyHtml") === "string" ? String(data.get("bodyHtml")) : undefined,
  });
}

export async function createCampaign(data: FormData): Promise<ActionResult> {
  const user = await requireRole("EDITOR");

  const parsed = campaignFromForm(data);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid campaign");

  const created = await prisma.campaign.create({
    data: {
      name: parsed.data.name,
      subject: parsed.data.subject,
      preheader: parsed.data.preheader ?? null,
      templateKey: parsed.data.templateKey ?? null,
      bodyHtml: parsed.data.bodyHtml ?? "",
      showId: parsed.data.showId ?? null,
      segmentId: parsed.data.segmentId ?? null,
      audience: filterFromForm(data),
      status: "DRAFT",
    },
  });

  await audit(user, "campaign.create", "Campaign", created.id, null, {
    name: created.name,
    subject: created.subject,
  });

  revalidatePath("/admin/campaigns");
  return { ok: true, id: created.id };
}

export async function updateCampaign(data: FormData): Promise<ActionResult> {
  const user = await requireRole("EDITOR");

  const parsed = campaignFromForm(data);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid campaign");
  if (!parsed.data.id) return fail("Missing campaign id");

  const before = await prisma.campaign.findUnique({ where: { id: parsed.data.id } });
  if (!before) return fail("Campaign not found");

  // Once a campaign is sending or sent, its content is a record of what went
  // out. Editing it would make the reporting a lie.
  if (before.status === "SENDING" || before.status === "SENT") {
    return fail("This campaign has already been sent and can no longer be edited");
  }

  const updated = await prisma.campaign.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      subject: parsed.data.subject,
      preheader: parsed.data.preheader ?? null,
      templateKey: parsed.data.templateKey ?? null,
      bodyHtml: parsed.data.bodyHtml ?? "",
      showId: parsed.data.showId ?? null,
      segmentId: parsed.data.segmentId ?? null,
      audience: filterFromForm(data),
    },
  });

  await audit(user, "campaign.update", "Campaign", updated.id, before, updated);
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${updated.id}`);
  return { ok: true, id: updated.id };
}

export async function deleteCampaign(input: unknown): Promise<ActionResult> {
  const user = await requireRole("EDITOR");
  const parsed = z.string().min(1).safeParse(input);
  if (!parsed.success) return fail("Invalid request");

  const campaign = await prisma.campaign.findUnique({ where: { id: parsed.data } });
  if (!campaign) return fail("Campaign not found");

  if (campaign.status === "SENDING") return fail("This campaign is sending right now");
  if (campaign.status === "SENT") {
    // A sent campaign plus its CampaignSend rows are the evidence of what the
    // business mailed to whom. Only an OWNER may destroy that.
    await requireRole("OWNER");
  }

  await prisma.campaign.delete({ where: { id: campaign.id } });
  await audit(user, "campaign.delete", "Campaign", campaign.id, campaign, null);
  revalidatePath("/admin/campaigns");
  return { ok: true };
}

/* ------------------------------------------------------------ test send */

export async function sendTest(data: FormData): Promise<ActionResult> {
  const user = await requireRole("EDITOR");

  const parsed = z
    .object({
      campaignId: z.string().min(1),
      to: z.string().email("Enter a valid email address"),
    })
    .safeParse({ campaignId: text(data.get("campaignId")), to: text(data.get("to")) });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request");

  try {
    await sendCampaignTest(parsed.data.campaignId, parsed.data.to);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not send the test");
  }

  await audit(user, "campaign.test_send", "Campaign", parsed.data.campaignId, null, {
    to: parsed.data.to,
  });
  revalidatePath(`/admin/campaigns/${parsed.data.campaignId}`);
  return { ok: true };
}

/* ------------------------------------------------------------- schedule */

export async function scheduleCampaign(data: FormData): Promise<ActionResult> {
  const user = await requireRole("EDITOR");

  const parsed = z
    .object({ campaignId: z.string().min(1), scheduledFor: z.string().min(1) })
    .safeParse({
      campaignId: text(data.get("campaignId")),
      scheduledFor: text(data.get("scheduledFor")),
    });
  if (!parsed.success) return fail("Pick a date and time");

  const when = new Date(parsed.data.scheduledFor);
  if (Number.isNaN(when.getTime())) return fail("That is not a valid date and time");
  // One minute of slack so "now" typed into the field is not a race with submit.
  if (when.getTime() < Date.now() - 60_000) return fail("That time is in the past");

  const campaign = await prisma.campaign.findUnique({ where: { id: parsed.data.campaignId } });
  if (!campaign) return fail("Campaign not found");
  if (campaign.status === "SENDING" || campaign.status === "SENT") {
    return fail("This campaign has already been sent");
  }

  const guard = await guardAudience(campaign.id);
  if (guard) return guard;

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "SCHEDULED", scheduledFor: when },
  });

  // Enqueued now rather than discovered later: the tick's promoteDueCampaigns is
  // only a backstop for rows that predate the runner.
  await enqueueCampaignSend(campaign.id, when);

  await audit(user, "campaign.schedule", "Campaign", campaign.id, { status: campaign.status }, {
    status: "SCHEDULED",
    scheduledFor: when.toISOString(),
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaign.id}`);
  return { ok: true, id: campaign.id };
}

export async function unscheduleCampaign(input: unknown): Promise<ActionResult> {
  const user = await requireRole("EDITOR");
  const parsed = z.string().min(1).safeParse(input);
  if (!parsed.success) return fail("Invalid request");

  const campaign = await prisma.campaign.findUnique({ where: { id: parsed.data } });
  if (!campaign) return fail("Campaign not found");
  if (campaign.status !== "SCHEDULED") return fail("This campaign is not scheduled");

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "DRAFT", scheduledFor: null },
  });

  // Cancel the queued job too. The handler also re-checks for DRAFT before
  // sending, so a job that slips through this delete still does nothing.
  await prisma.job.deleteMany({
    where: {
      kind: "send_campaign",
      status: "PENDING",
      payload: { path: ["campaignId"], equals: campaign.id },
    },
  });

  await audit(user, "campaign.unschedule", "Campaign", campaign.id, { status: "SCHEDULED" }, {
    status: "DRAFT",
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaign.id}`);
  return { ok: true };
}

/* ----------------------------------------------------------- send now */

/**
 * Queue the send and return immediately.
 *
 * A list of several thousand takes minutes at the provider's rate limit, which
 * is far longer than any request should live. The job row is the durable part;
 * the in-process kick just means the team does not wait for the next tick. If
 * the process dies before it finishes, the cron tick reclaims the stale lock and
 * the send resumes from the rows still marked QUEUED.
 */
export async function sendCampaignNow(input: unknown): Promise<ActionResult> {
  const user = await requireRole("EDITOR");
  const parsed = z.string().min(1).safeParse(input);
  if (!parsed.success) return fail("Invalid request");

  const campaign = await prisma.campaign.findUnique({ where: { id: parsed.data } });
  if (!campaign) return fail("Campaign not found");
  if (campaign.status === "SENT") return fail("This campaign has already been sent");
  if (campaign.status === "SENDING") return fail("This campaign is already sending");
  if (!campaign.subject.trim()) return fail("Add a subject line first");

  const guard = await guardAudience(campaign.id);
  if (guard) return guard;

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "SCHEDULED", scheduledFor: new Date() },
  });

  const job = await enqueueCampaignSend(campaign.id);

  await audit(user, "campaign.send", "Campaign", campaign.id, null, {
    name: campaign.name,
    jobId: job.id,
    recipients: campaign.totalRecipients,
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaign.id}`);

  // Fire and forget. Deliberately not awaited: see the doc comment above.
  void runJobById(job.id).catch((err) => {
    console.error("[campaign] background send failed", err);
  });

  return { ok: true, id: campaign.id };
}

/** Recompute the recipient count for a campaign's one-off or saved audience. */
export async function recountCampaignAudience(input: unknown): Promise<ActionResult> {
  await requireRole("EDITOR");
  const parsed = z.string().min(1).safeParse(input);
  if (!parsed.success) return fail("Invalid request");

  const campaign = await prisma.campaign.findUnique({
    where: { id: parsed.data },
    include: { segment: true },
  });
  if (!campaign) return fail("Campaign not found");
  if (campaign.status === "SENDING" || campaign.status === "SENT") return { ok: true };

  const filter = campaign.segment
    ? coerceFilter(campaign.segment.filter)
    : coerceFilter(campaign.audience);
  const { mailable } = await countAudience(filter);

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { totalRecipients: mailable },
  });

  revalidatePath(`/admin/campaigns/${campaign.id}`);
  return { ok: true };
}

/**
 * Refuse to start a send with nobody to send to. Without this a mistyped filter
 * produces a campaign marked FAILED for a reason nobody can see.
 */
async function guardAudience(campaignId: string): Promise<ActionResult | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { segment: true },
  });
  if (!campaign) return fail("Campaign not found");

  const existing = await prisma.campaignSend.count({ where: { campaignId } });
  if (existing > 0) return null; // resuming a partial send

  const filter = campaign.segment
    ? coerceFilter(campaign.segment.filter)
    : coerceFilter(campaign.audience);
  const { mailable } = await countAudience(filter);

  if (mailable === 0) {
    return fail(
      "Nobody matches this audience who has consented to marketing email. Widen the filter or check the opt-in count.",
    );
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { totalRecipients: mailable },
  });
  return null;
}
