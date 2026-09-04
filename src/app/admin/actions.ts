"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";
import { LEAD_STATUSES } from "@/lib/admin/leads";

/**
 * Mutations for the leads inbox.
 *
 * Every one re-checks the session server-side. A server action is a public HTTP
 * endpoint with a generated name — being reachable only from a page the user had
 * to log in to see is not authorisation, and middleware has proven bypassable
 * before (CVE-2025-29927).
 *
 * Every one also writes an AuditLog row. Roles that are never recorded are
 * decoration; when the client asks who moved an entry to REJECTED, there has to
 * be an answer.
 */

async function audit(
  user: SessionUser,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
  entityType = "Lead",
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

type Result = { ok: true } | { ok: false; error: string };

/* ------------------------------------------------------------------ status */

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(LEAD_STATUSES),
});

/** REVIEWER and up. Triaging entries is the reviewer role's whole purpose. */
export async function setLeadStatus(input: unknown): Promise<Result> {
  const user = await requireRole("REVIEWER");
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  const before = await prisma.lead.findUnique({
    where: { id: parsed.data.id },
    select: { status: true },
  });
  if (!before) return { ok: false, error: "Lead not found" };
  if (before.status === parsed.data.status) return { ok: true };

  await prisma.lead.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  await audit(user, "lead.status_change", parsed.data.id, before, {
    status: parsed.data.status,
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${parsed.data.id}`);
  return { ok: true };
}

/* ------------------------------------------------------------------- notes */

const notesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().max(5000),
});

export async function setLeadNotes(input: unknown): Promise<Result> {
  const user = await requireRole("REVIEWER");
  const parsed = notesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Note is too long" };

  const before = await prisma.lead.findUnique({
    where: { id: parsed.data.id },
    select: { internalNotes: true },
  });
  if (!before) return { ok: false, error: "Lead not found" };

  await prisma.lead.update({
    where: { id: parsed.data.id },
    data: { internalNotes: parsed.data.notes || null },
  });

  // The note body is not copied into the audit log: it can contain personal
  // detail about a contestant, and duplicating that into a second table nobody
  // prunes makes a subject-access or erasure request harder to satisfy.
  await audit(user, "lead.note_edit", parsed.data.id, { had: Boolean(before.internalNotes) }, {
    has: Boolean(parsed.data.notes),
  });

  revalidatePath(`/admin/leads/${parsed.data.id}`);
  return { ok: true };
}

/* -------------------------------------------------------------------- tags */

const tagSchema = z.object({
  leadId: z.string().min(1),
  name: z.string().min(1).max(40),
});

export async function addTag(input: unknown): Promise<Result> {
  const user = await requireRole("REVIEWER");
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid tag name" };

  const name = parsed.data.name.trim();
  const tag = await prisma.tag.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  await prisma.tagOnLead.upsert({
    where: { leadId_tagId: { leadId: parsed.data.leadId, tagId: tag.id } },
    update: {},
    create: { leadId: parsed.data.leadId, tagId: tag.id },
  });

  await audit(user, "lead.tag_add", parsed.data.leadId, null, { tag: name });
  revalidatePath(`/admin/leads/${parsed.data.leadId}`);
  revalidatePath("/admin/leads");
  return { ok: true };
}

export async function removeTag(input: unknown): Promise<Result> {
  const user = await requireRole("REVIEWER");
  const parsed = z
    .object({ leadId: z.string().min(1), tagId: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  await prisma.tagOnLead
    .delete({
      where: { leadId_tagId: { leadId: parsed.data.leadId, tagId: parsed.data.tagId } },
    })
    .catch(() => null);

  await audit(user, "lead.tag_remove", parsed.data.leadId, { tagId: parsed.data.tagId }, null);
  revalidatePath(`/admin/leads/${parsed.data.leadId}`);
  revalidatePath("/admin/leads");
  return { ok: true };
}

/* ------------------------------------------------------------------- bulk */

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  status: z.enum(LEAD_STATUSES).optional(),
  tagName: z.string().min(1).max(40).optional(),
});

/**
 * Bulk status change or bulk tag. Capped at 500 ids so a crafted request cannot
 * ask the database to rewrite the whole table in one statement.
 */
export async function bulkUpdate(input: unknown): Promise<Result> {
  const user = await requireRole("REVIEWER");
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };
  const { ids, status, tagName } = parsed.data;
  if (!status && !tagName) return { ok: false, error: "Nothing to apply" };

  if (status) {
    await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { status } });
    await audit(user, "lead.bulk_status", ids.join(","), null, { status, count: ids.length });
  }

  if (tagName) {
    const tag = await prisma.tag.upsert({
      where: { name: tagName.trim() },
      update: {},
      create: { name: tagName.trim() },
    });
    await prisma.tagOnLead.createMany({
      data: ids.map((leadId) => ({ leadId, tagId: tag.id })),
      skipDuplicates: true,
    });
    await audit(user, "lead.bulk_tag", ids.join(","), null, {
      tag: tagName,
      count: ids.length,
    });
  }

  revalidatePath("/admin/leads");
  return { ok: true };
}

/* ------------------------------------------------------------------ delete */

/**
 * OWNER only, and a hard delete rather than a flag — this is what satisfies a
 * UK GDPR erasure request, so it has to actually remove the row. The audit entry
 * keeps the email so the deletion itself can be evidenced.
 */
export async function deleteLead(input: unknown): Promise<Result> {
  const user = await requireRole("OWNER");
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const lead = await prisma.lead.findUnique({
    where: { id: parsed.data.id },
    select: { email: true, type: true },
  });
  if (!lead) return { ok: false, error: "Lead not found" };

  await prisma.lead.delete({ where: { id: parsed.data.id } });
  await audit(user, "lead.delete", parsed.data.id, lead, null);

  revalidatePath("/admin/leads");
  return { ok: true };
}
