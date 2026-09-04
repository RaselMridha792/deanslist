import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type EmailEventType, type SendStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { refreshCampaignCounters } from "@/lib/campaigns/send";

/**
 * Resend delivery events.
 *
 * This endpoint is public and it writes to the database, so the signature check
 * is the whole security model. Without it, anyone who learns the URL can forge a
 * hard bounce for every address on the list and suppress the entire audience —
 * a one-request denial of the client's own marketing channel.
 *
 * Resend signs with the Standard Webhooks scheme (Svix): HMAC-SHA256 over
 * `${id}.${timestamp}.${rawBody}` keyed by the base64 body of the `whsec_`
 * secret. Verified here with node:crypto rather than by adding the `svix`
 * package — it is thirty lines and every dependency is a maintenance and supply
 * chain cost on a small VPS.
 *
 * The other job this route does is protect the sending domain. A hard bounce or
 * a spam complaint writes a Suppression row immediately. Continuing to mail an
 * address that bounced hard is how a domain ends up on a blocklist, and once
 * that happens every transactional email from the site stops arriving too.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Replay window. Standard Webhooks recommends five minutes. */
const TOLERANCE_MS = 5 * 60 * 1000;

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Verify a Standard Webhooks / Svix signature.
 * Returns true only when a v1 signature in the header matches.
 */
function verify(raw: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id") ?? headers.get("webhook-id");
  const timestamp = headers.get("svix-timestamp") ?? headers.get("webhook-timestamp");
  const signature = headers.get("svix-signature") ?? headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return false;

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  const drift = Math.abs(Date.now() - seconds * 1000);
  // Rejects replays of a captured request, in both directions.
  if (drift > TOLERANCE_MS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${raw}`)
    .digest("base64");

  // The header carries a space-separated list so a secret can be rotated with
  // an overlap window. Any one match is enough.
  for (const part of signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    if (safeEqual(value, expected)) return true;
  }
  return false;
}

/* ------------------------------------------------------------- mapping */

const EVENT_MAP: Record<string, EmailEventType | "FAILED" | "SENT"> = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "DELIVERY_DELAYED",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
  "email.failed": "FAILED",
};

/** Send status only ever moves forward. Webhooks arrive out of order. */
const RANK: Record<SendStatus, number> = {
  QUEUED: 0,
  SENT: 1,
  OPENED: 2,
  CLICKED: 3,
  BOUNCED: 4,
  FAILED: 4,
};

type Payload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
    click?: { link?: string };
    reason?: string;
  };
};

function firstAddress(to: string[] | string | undefined): string {
  if (Array.isArray(to)) return (to[0] ?? "").trim().toLowerCase();
  return (to ?? "").trim().toLowerCase();
}

/**
 * A bounce is "hard" when the provider says Permanent — and also when it says
 * nothing at all. That default is deliberate: over-suppressing costs one
 * subscriber, under-suppressing costs the sending domain's reputation, and only
 * one of those is recoverable.
 */
function isHardBounce(bounce: { type?: string } | undefined): boolean {
  const type = bounce?.type?.toLowerCase();
  if (!type) return true;
  return type === "permanent";
}

/* ---------------------------------------------------------------- route */

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Bounds a signature-guessing flood without throttling a legitimate burst of
  // delivery events, which arrive far faster than this from one provider IP.
  if (!rateLimit(`resend-hook:${ip}`, 600, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed. An unverified event that can suppress addresses is worse than
    // no event handling at all.
    console.warn("[resend-hook] RESEND_WEBHOOK_SECRET is not set; rejecting webhook");
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  // The raw body, byte for byte. Parsing first and re-serialising would change
  // key order and whitespace, and the signature would never match.
  const raw = await req.text();

  if (!verify(raw, req.headers, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = JSON.parse(raw) as Payload;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const mapped = payload.type ? EVENT_MAP[payload.type] : undefined;
  if (!mapped) {
    // Unknown event types are acknowledged, not retried. Resend adds new ones.
    return NextResponse.json({ ok: true, ignored: payload.type ?? null });
  }

  const providerId = payload.data?.email_id ?? null;
  const email = firstAddress(payload.data?.to);
  const at = payload.created_at ? new Date(payload.created_at) : new Date();
  const occurredAt = Number.isNaN(at.getTime()) ? new Date() : at;

  const send = providerId
    ? await prisma.campaignSend.findFirst({
        where: { providerId },
        select: { id: true, campaignId: true, status: true },
      })
    : null;

  try {
    await handleEvent({ mapped, payload, providerId, email, occurredAt, send });
  } catch (err) {
    console.error("[resend-hook] failed to record event", err);
    // 500 asks Resend to retry. Every write below is either an upsert or guarded
    // by a null check, so a retry re-applies safely.
    return NextResponse.json({ error: "Could not record event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/* --------------------------------------------------------------- writes */

type HandleArgs = {
  mapped: EmailEventType | "FAILED" | "SENT";
  payload: Payload;
  providerId: string | null;
  email: string;
  occurredAt: Date;
  send: { id: string; campaignId: string; status: SendStatus } | null;
};

async function handleEvent({
  mapped,
  payload,
  providerId,
  email,
  occurredAt,
  send,
}: HandleArgs) {
  const bounce = payload.data?.bounce;
  const reason =
    bounce?.message ??
    payload.data?.reason ??
    (bounce?.subType ? `${bounce.type ?? "bounce"}/${bounce.subType}` : undefined);

  // `email.sent` is the provider echoing our own send back; the row already says
  // SENT. Nothing to record beyond that.
  if (mapped === "SENT") return;

  if (mapped !== "FAILED") {
    await prisma.emailEvent.create({
      data: {
        type: mapped,
        email,
        providerId,
        sendId: send?.id ?? null,
        url: payload.data?.click?.link ?? null,
        reason: reason ?? null,
        raw: payload as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // A bounce or complaint on a transactional email has no CampaignSend, and it
  // still has to suppress the address. Suppression comes before the send update
  // for exactly that reason.
  if (mapped === "BOUNCED" && isHardBounce(bounce)) {
    await suppress(email, "HARD_BOUNCE", reason);
  }
  if (mapped === "COMPLAINED") {
    await suppress(email, "COMPLAINT", reason);
    // A spam complaint is a withdrawal of consent, not just a dead address.
    if (email) {
      await prisma.lead.updateMany({
        where: { email, unsubscribedAt: null },
        data: { marketingOptIn: false, unsubscribedAt: occurredAt },
      });
    }
  }

  if (!send) return;

  switch (mapped) {
    case "DELIVERED": {
      const first = await prisma.campaignSend.updateMany({
        where: { id: send.id, deliveredAt: null },
        data: { deliveredAt: occurredAt },
      });
      await advance(send, "SENT");
      if (first.count === 1) {
        await prisma.campaign.update({
          where: { id: send.campaignId },
          data: { totalDelivered: { increment: 1 } },
        });
      }
      break;
    }

    case "OPENED": {
      // openCount is deliberately not deduplicated. Svix retries and image
      // proxies both re-fire opens, so the count is a fuzzy engagement signal by
      // nature; totalOpened counts unique recipients and is guarded below.
      await prisma.campaignSend.update({
        where: { id: send.id },
        data: { openCount: { increment: 1 } },
      });
      const first = await prisma.campaignSend.updateMany({
        where: { id: send.id, openedAt: null },
        data: { openedAt: occurredAt },
      });
      await advance(send, "OPENED");
      if (first.count === 1) {
        await prisma.campaign.update({
          where: { id: send.campaignId },
          data: { totalOpened: { increment: 1 } },
        });
      }
      break;
    }

    case "CLICKED": {
      await prisma.campaignSend.update({
        where: { id: send.id },
        data: { clickCount: { increment: 1 } },
      });
      const first = await prisma.campaignSend.updateMany({
        where: { id: send.id, clickedAt: null },
        data: { clickedAt: occurredAt },
      });
      await advance(send, "CLICKED");
      if (first.count === 1) {
        await prisma.campaign.update({
          where: { id: send.campaignId },
          data: { totalClicked: { increment: 1 } },
        });
      }
      break;
    }

    case "BOUNCED": {
      await prisma.campaignSend.update({
        where: { id: send.id },
        data: { status: "BOUNCED", error: reason?.slice(0, 500) ?? "Bounced" },
      });
      // Rare enough to afford an exact rebuild rather than an increment.
      await refreshCampaignCounters(send.campaignId);
      break;
    }

    case "FAILED": {
      await prisma.campaignSend.update({
        where: { id: send.id },
        data: { status: "FAILED", error: reason?.slice(0, 500) ?? "Provider reported failure" },
      });
      await refreshCampaignCounters(send.campaignId);
      break;
    }

    case "COMPLAINED":
    case "DELIVERY_DELAYED":
      // Recorded as an EmailEvent above. Neither changes the send's own status:
      // the message did arrive, which is precisely why it was complained about.
      break;
  }
}

/** Move a send's status forward only. An out-of-order open must not undo a click. */
async function advance(
  send: { id: string; status: SendStatus },
  next: SendStatus,
): Promise<void> {
  if (RANK[next] <= RANK[send.status]) return;
  await prisma.campaignSend.update({ where: { id: send.id }, data: { status: next } });
  send.status = next;
}

async function suppress(
  email: string,
  reason: "HARD_BOUNCE" | "COMPLAINT",
  note?: string,
): Promise<void> {
  if (!email || !email.includes("@")) return;
  await prisma.suppression.upsert({
    where: { email },
    // Never downgrade an existing record. A complaint is stronger than a bounce
    // and an unsubscribe is a stated wish; none of them should be overwritten.
    update: {},
    create: { email, reason, note: note?.slice(0, 500) ?? null },
  });
}
