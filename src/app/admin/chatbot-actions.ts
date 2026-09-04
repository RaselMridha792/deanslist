"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";
import { invalidateKnowledgeCache } from "@/lib/chat/knowledge";

/**
 * Mutations for the chatbot console: transcript triage and the knowledge base.
 *
 * Every one re-checks the session server-side. A server action is a public HTTP
 * endpoint with a generated name — being reachable only from a page behind a
 * login is not authorisation, and middleware has proven bypassable before
 * (CVE-2025-29927).
 *
 * EDITOR and up throughout. The chatbot console is not a reader's screen: the
 * knowledge base is publishing, and a transcript holds whatever a visitor typed
 * into a public box, which is the same class of personal data as a lead.
 * `/admin/chatbot` is already EDITOR-gated in AdminNav, so guarding the review
 * action at REVIEWER would only open an endpoint no reviewer can reach a screen
 * for.
 */

const KNOWLEDGE_PATH = "/admin/chatbot/knowledge";

type Result = { ok: true; id?: string } | { ok: false; error: string };

/**
 * The widget caches active knowledge rows for a minute. Without this, a screen
 * that has just said "taken offline" would keep being contradicted by the bot
 * for up to sixty seconds — which is the whole window that matters when the
 * reason for pulling an answer is that it was wrong.
 */
function publishKnowledgeChange() {
  invalidateKnowledgeCache();
  revalidatePath(KNOWLEDGE_PATH);
}

/**
 * Mirrors the audit() helper in src/app/admin/actions.ts. Not imported from it:
 * that module is "use server", so its private helpers cannot be exported without
 * becoming public endpoints of their own.
 */
async function audit(
  user: SessionUser,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
  entityType: string,
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

/* -------------------------------------------------------- specific-fact scan */

/**
 * "Does this answer state something that has to be true?"
 *
 * The bot answers from these rows and nothing else, so a prize amount or a
 * closing date typed here is repeated to contestants as fact about a public
 * prize competition. The patterns are deliberately loose and will over-flag —
 * what this produces is a human pausing to ask "did the client actually confirm
 * that?", not a precise classifier. Under-flagging is the expensive failure; a
 * false positive costs one tick of a box.
 */
const SPECIFIC_PATTERNS: readonly { label: string; re: RegExp }[] = [
  {
    label: "a money amount",
    re: /[$£€]\s?\d|\b\d[\d,]*(?:\.\d+)?\s?(?:k\b|usd\b|dollars?\b|gbp\b|pounds?\b|eur\b|euros?\b)/i,
  },
  {
    label: "a date or time",
    re: /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b|\b20\d{2}\b|\b\d{1,2}(?::\d{2})?\s?[ap]\.?m\.?\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  },
  {
    label: "a deadline or closing window",
    // "by 5pm" cannot carry a trailing word boundary, so the relative forms are
    // a separate alternative rather than another word in the list.
    re: /\b(?:deadline|closes|closing|cut[\s-]?off|entries close|last day|final day|midnight|expires?)\b|\b(?:until|by|before)\s+\d/i,
  },
  {
    // BUILD-PLAN 8.4 puts eligibility in the same class as dates and prizes:
    // "you must be 18" is a term of entry, and the client is the only source for
    // it. Detected here for the same reason, even though it is not a number the
    // reader would call a "specific".
    label: "a rule about who may enter",
    re: /\b(?:must be|eligible|eligibility|open (?:only )?to|aged?\s+\d|over \d{1,2}|under \d{1,2}|\d{1,2}\+|residents? of|citizens? of|legal guardian|parental consent)\b/i,
  },
];

function detectSpecifics(text: string): string[] {
  return SPECIFIC_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}

function humanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The same detector the save path enforces, exposed so the knowledge screen can
 * badge existing rows without a second copy of the patterns drifting out of sync
 * with the ones that actually block a save. Takes the whole list in one call so
 * the page pays for one session check rather than one per row.
 */
export async function scanForSpecifics(texts: unknown): Promise<string[][]> {
  await requireRole("EDITOR");
  const parsed = z.array(z.string().max(20_000)).max(1000).safeParse(texts);
  if (!parsed.success) return [];
  return parsed.data.map(detectSpecifics);
}

/* ------------------------------------------------------------- form parsing */

function fieldText(data: FormData, key: string): string {
  const v = data.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** An unchecked checkbox submits nothing at all, which is the false case. */
function fieldChecked(data: FormData, key: string): boolean {
  const v = data.get(key);
  return v === "on" || v === "true";
}

/* -------------------------------------------------------------- transcripts */

const reviewSchema = z.object({
  id: z.string().min(1).max(60),
  reviewed: z.enum(["true", "false"]),
});

/**
 * Mark a transcript as read by a human, or put it back in the queue.
 *
 * This is deliberately NOT `Conversation.resolved`. That column belongs to the
 * public chat route, which sets it when the VISITOR finishes the capture flow —
 * a fact about them, written without anyone here having seen a word of the
 * thread. Reusing it as "an admin has dealt with this" quietly stamped every
 * completed chat as reviewed, so the queue read empty exactly when it was
 * fullest. `reviewedAt` / `reviewedBy` are written only from here.
 *
 * Still the only thing a reviewer may change about a transcript: the messages
 * are the record of what a visitor was actually told and are never editable
 * from the UI.
 */
export async function setConversationReviewed(data: FormData): Promise<Result> {
  const user = await requireRole("EDITOR");
  const parsed = reviewSchema.safeParse({
    id: data.get("id"),
    reviewed: data.get("reviewed"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const reviewed = parsed.data.reviewed === "true";
  const before = await prisma.conversation.findUnique({
    where: { id: parsed.data.id },
    select: { reviewedAt: true, reviewedBy: true },
  });
  if (!before) return { ok: false, error: "Conversation not found" };
  if ((before.reviewedAt !== null) === reviewed) return { ok: true };

  // Reopening clears the reviewer too. A row that still named someone while
  // sitting in the queue would read as "already handled by them".
  const after = reviewed
    ? { reviewedAt: new Date(), reviewedBy: user.email }
    : { reviewedAt: null, reviewedBy: null };

  await prisma.conversation.update({ where: { id: parsed.data.id }, data: after });

  // Flags only. Message bodies stay out of the audit log: they hold whatever a
  // visitor typed, and copying that into a second table nobody prunes makes an
  // erasure request harder to satisfy. Dates go in as ISO strings because the
  // columns are Json, which has no Date.
  await audit(
    user,
    reviewed ? "conversation.review" : "conversation.reopen",
    parsed.data.id,
    { reviewedAt: before.reviewedAt?.toISOString() ?? null, reviewedBy: before.reviewedBy },
    { reviewedAt: after.reviewedAt?.toISOString() ?? null, reviewedBy: after.reviewedBy },
    "Conversation",
  );

  revalidatePath("/admin/chatbot");
  revalidatePath(`/admin/chatbot/${parsed.data.id}`);
  return { ok: true };
}

/* ----------------------------------------------------------- knowledge base */

const knowledgeSchema = z.object({
  id: z.string().max(60).optional(),
  question: z
    .string()
    .min(5, "Write the question the way a visitor would ask it")
    .max(300, "Keep the question under 300 characters"),
  answer: z
    .string()
    .min(10, "An answer this short will not help anyone")
    .max(4000, "Keep the answer under 4000 characters"),
  category: z.string().max(40, "Category is too long").optional(),
  active: z.boolean(),
  confirmed: z.boolean(),
});

/**
 * Create or update one knowledge item. One action for both paths so they cannot
 * drift on validation, on the specifics gate, or on what gets audited.
 */
export async function saveKnowledgeItem(data: FormData): Promise<Result> {
  const user = await requireRole("EDITOR");

  const id = fieldText(data, "id") || undefined;
  const parsed = knowledgeSchema.safeParse({
    id,
    question: fieldText(data, "question"),
    answer: fieldText(data, "answer"),
    category: fieldText(data, "category") || undefined,
    active: fieldChecked(data, "active"),
    confirmed: fieldChecked(data, "confirmed"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields" };
  }

  const { question, answer, category, active, confirmed } = parsed.data;

  // The gate that makes the warning mean something. A banner people scroll past
  // is decoration; refusing the save until someone confirms the specific is the
  // part that actually stops a guessed deadline reaching a contestant.
  const flags = detectSpecifics(`${question}\n${answer}`);
  if (flags.length > 0 && !confirmed) {
    return {
      ok: false,
      error: `This answer states ${humanList(
        flags,
      )}. The assistant will repeat it to contestants as fact. Check it against something the client has confirmed, then tick the confirmation box to save.`,
    };
  }

  const values = { question, answer, category: category ?? null, active };

  if (id) {
    const before = await prisma.knowledgeItem.findUnique({
      where: { id },
      select: { question: true, answer: true, category: true, active: true },
    });
    if (!before) return { ok: false, error: "That answer no longer exists" };

    await prisma.knowledgeItem.update({ where: { id }, data: values });

    // Unlike a lead note, the full before and after is kept. This text is
    // published to the public through the bot, it holds no personal data, and
    // "who changed the prize answer, and what did it say before?" is exactly the
    // question this log exists to answer.
    await audit(user, "knowledge.update", id, before, { ...values, confirmed }, "KnowledgeItem");
    publishKnowledgeChange();
    return { ok: true, id };
  }

  const created = await prisma.knowledgeItem.create({ data: values });
  await audit(
    user,
    "knowledge.create",
    created.id,
    null,
    { ...values, confirmed },
    "KnowledgeItem",
  );
  publishKnowledgeChange();
  return { ok: true, id: created.id };
}

/**
 * One-click publish / take offline, kept out of the edit form so a wrong answer
 * can be pulled out of the bot's reach immediately, without first re-passing the
 * specifics gate that let it through in the first place. Returns void because a
 * plain <form action={...}> submits it, which keeps it working without
 * JavaScript.
 */
export async function toggleKnowledgeActive(data: FormData): Promise<void> {
  const user = await requireRole("EDITOR");
  const parsed = z
    .object({ id: z.string().min(1).max(60), active: z.enum(["true", "false"]) })
    .safeParse({ id: data.get("id"), active: data.get("active") });
  if (!parsed.success) return;

  const active = parsed.data.active === "true";
  const before = await prisma.knowledgeItem.findUnique({
    where: { id: parsed.data.id },
    select: { question: true, active: true },
  });
  if (!before || before.active === active) {
    publishKnowledgeChange();
    return;
  }

  await prisma.knowledgeItem.update({ where: { id: parsed.data.id }, data: { active } });
  await audit(
    user,
    active ? "knowledge.publish" : "knowledge.unpublish",
    parsed.data.id,
    before,
    { question: before.question, active },
    "KnowledgeItem",
  );
  publishKnowledgeChange();
}

/**
 * Hard delete. The audit row keeps the full text, so a removed answer can be
 * reconstructed by hand — otherwise "the bot used to say X, who took it out?"
 * would be unanswerable.
 */
export async function deleteKnowledgeItem(id: string): Promise<Result> {
  const user = await requireRole("EDITOR");
  const parsed = z.string().min(1).max(60).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const before = await prisma.knowledgeItem.findUnique({
    where: { id: parsed.data },
    select: { question: true, answer: true, category: true, active: true },
  });
  if (!before) return { ok: false, error: "That answer no longer exists" };

  await prisma.knowledgeItem.delete({ where: { id: parsed.data } });
  await audit(user, "knowledge.delete", parsed.data, before, null, "KnowledgeItem");

  publishKnowledgeChange();
  return { ok: true };
}
