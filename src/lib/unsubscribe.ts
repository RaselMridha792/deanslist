import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * One-click unsubscribe: token minting, resolution, and the write that actually
 * removes someone from the list.
 *
 * ## Why the token is stored, not derived
 *
 * The first version of this file signed the lead id with an HMAC keyed on
 * AUTH_SECRET and stored nothing. It verified with no database lookup, which is
 * cheap and unforgeable — and wrong for this one job, because the key is
 * rotatable. Rotating AUTH_SECRET is a normal, encouraged security action, and
 * the moment it happens every unsubscribe link in every email already delivered
 * stops verifying. Recipients who then try to opt out are told the link is not
 * valid. That is precisely the compliance failure this feature exists to
 * prevent, caused by doing the responsible thing with a secret.
 *
 * So the token is a 256-bit random string persisted in `Lead.unsubscribeToken`
 * — the `@unique` column the schema already documents as "minted on first
 * marketing send, never reused". A link works because a row matches it, and no
 * secret takes part in that match. Rotate AUTH_SECRET as often as you like;
 * mail sent last year still unsubscribes.
 *
 * No HMAC is wrapped around the stored token. It would have to verify for the
 * link to work, which reintroduces the rotation hazard it was meant to guard
 * against, and it adds nothing: 256 bits of CSPRNG output is already
 * unguessable and unenumerable. What the HMAC did buy — rejecting junk without
 * touching the database — is kept by checking the token's shape first, so an
 * enumeration attempt costs a regex, not a query.
 *
 * ## Two token formats
 *
 *   u2.<43 chars>            current. Random, stored, survives key rotation.
 *   u1.<b64 id>.<signature>  legacy HMAC. Still accepted so links already in
 *                            inboxes keep working — until AUTH_SECRET rotates,
 *                            which is the whole reason for u2.
 */

/* ---------------------------------------------------------------- formats */

const STORED_VERSION = "u2";
const LEGACY_VERSION = "u1";

/** 32 bytes of CSPRNG, base64url, unpadded — 43 characters. */
const TOKEN_BYTES = 32;

/**
 * Exact shape of a current token. The length is fixed, so a link truncated by a
 * mail client fails here rather than costing a lookup, and nothing that is not
 * shaped like a token we minted ever reaches the database.
 */
const STORED_PATTERN = /^u2\.[A-Za-z0-9_-]{43}$/;

/** Domain separation for the legacy scheme: this key is shared with sessions. */
const PURPOSE = "unsubscribe:v1";

/** cuid, cuid2 and uuid all fit. Anything else is not an id we minted. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function legacySign(leadId: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`${PURPOSE}:${leadId}`).digest("base64url");
}

function legacyToken(leadId: string): string {
  const encodedId = Buffer.from(leadId, "utf8").toString("base64url");
  return `${LEGACY_VERSION}.${encodedId}.${legacySign(leadId)}`;
}

/** Returns the lead id a legacy token was minted for, or null if it is not genuine. */
function verifyLegacyToken(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [version, encodedId, signature] = parts;
  if (version !== LEGACY_VERSION || !encodedId || !signature) return null;

  // Buffer.from never throws on malformed base64url — it decodes what it can and
  // the signature check below rejects the result.
  const leadId = Buffer.from(encodedId, "base64url").toString("utf8");
  if (!ID_PATTERN.test(leadId)) return null;

  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(legacySign(leadId), "utf8");
  // timingSafeEqual throws on a length mismatch, and the length itself is not a
  // secret, so it is checked first.
  if (provided.length !== expected.length) return null;

  return timingSafeEqual(provided, expected) ? leadId : null;
}

/**
 * What a token claims to be, decided without touching the database.
 *
 * `null` means it is not a token this system ever issued — junk, a truncation,
 * or an enumeration attempt — and the caller should throttle it hard. A
 * non-null result is not proof a lead exists; only the lookup settles that.
 */
export type UnsubscribeTokenShape =
  | { kind: "stored"; token: string }
  | { kind: "legacy"; leadId: string };

export function classifyUnsubscribeToken(
  token: string | null | undefined,
): UnsubscribeTokenShape | null {
  const value = (token ?? "").trim();
  if (!value) return null;
  if (STORED_PATTERN.test(value)) return { kind: "stored", token: value };
  const leadId = verifyLegacyToken(value);
  return leadId ? { kind: "legacy", leadId } : null;
}

/* ---------------------------------------------------------------- minting */

function newStoredToken(): string {
  return `${STORED_VERSION}.${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

/** Prisma's unique-constraint code, duck-typed so this file imports no client types. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

/**
 * The lead's permanent unsubscribe token, minting and storing one the first
 * time it is asked for.
 *
 * Idempotent and safe under concurrency. The claim is an `updateMany` gated on
 * `unsubscribeToken: null`, so two sends racing on the same lead cannot
 * overwrite each other — the loser re-reads and returns the winner's token
 * rather than issuing a second link. That is the "never reused" half of the
 * schema comment: one lead, one token, for the life of the row.
 *
 * Throws when the lead does not exist. A caller that cannot mint a token must
 * not send the message: an email with no working way out is the failure this
 * whole module exists to prevent, and failing one recipient is cheaper than
 * mailing somebody something they cannot escape.
 */
export async function ensureUnsubscribeToken(leadId: string): Promise<string> {
  const existing = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { unsubscribeToken: true },
  });
  if (!existing) {
    throw new Error(`[unsubscribe] no lead ${leadId} to mint an unsubscribe token for`);
  }
  if (existing.unsubscribeToken) return existing.unsubscribeToken;

  // Two ways round this loop: a lost race (count 0) or a unique collision. The
  // collision is a 2^-256 event and the retry is here for completeness only.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = newStoredToken();
    try {
      const claimed = await prisma.lead.updateMany({
        where: { id: leadId, unsubscribeToken: null },
        data: { unsubscribeToken: token },
      });
      if (claimed.count === 1) return token;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      continue;
    }

    // count 0: another request minted first, or the row went away.
    const row = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { unsubscribeToken: true },
    });
    if (!row) {
      throw new Error(`[unsubscribe] lead ${leadId} disappeared while minting a token`);
    }
    if (row.unsubscribeToken) return row.unsubscribeToken;
  }

  throw new Error(`[unsubscribe] could not mint an unsubscribe token for lead ${leadId}`);
}

/* -------------------------------------------------------------------- urls */

function absolute(path: string): string {
  return new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();
}

function pageUrl(token: string): string {
  return absolute(`/unsubscribe/${encodeURIComponent(token)}`);
}

function endpointUrl(token: string): string {
  return absolute(`/api/unsubscribe?token=${encodeURIComponent(token)}`);
}

function headersFor(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${endpointUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * The human-facing link that goes in every email footer. GET, confirms first.
 *
 * Async because a durable token has to be read or written, and that is the
 * point: there is no way to produce a link that outlives a key rotation without
 * the database knowing about it.
 */
export async function unsubscribeUrlFor(leadId: string): Promise<string> {
  return pageUrl(await ensureUnsubscribeToken(leadId));
}

/** The machine endpoint named by the List-Unsubscribe header. POST only. */
export async function oneClickUnsubscribeUrlFor(leadId: string): Promise<string> {
  return endpointUrl(await ensureUnsubscribeToken(leadId));
}

/**
 * Headers for every marketing send. Gmail and Yahoo require these on bulk mail;
 * without them a sender's reputation degrades no matter how clean the list is.
 *
 * No `mailto:` variant is advertised. RFC 2369 allows one, but a mailbox nobody
 * monitors is a promise the client cannot keep, and an unhonoured unsubscribe is
 * worse than one route fewer. Add it only when someone is processing that inbox.
 */
export async function listUnsubscribeHeadersFor(leadId: string): Promise<Record<string, string>> {
  return headersFor(await ensureUnsubscribeToken(leadId));
}

/* ------------------------------------------------------------ legacy urls */

let warnedLegacyMint = false;

function warnLegacyMint() {
  if (warnedLegacyMint) return;
  warnedLegacyMint = true;
  console.warn(
    "[unsubscribe] a caller is still minting legacy HMAC links. Every one of them " +
      "stops working the moment AUTH_SECRET is rotated. Switch to unsubscribeUrlFor() " +
      "and listUnsubscribeHeadersFor(), which are async and store the token.",
  );
}

/**
 * @deprecated Legacy HMAC link, kept only so existing synchronous callers keep
 * compiling. Every link it produces dies on the next AUTH_SECRET rotation. Use
 * `unsubscribeUrlFor()` and await it.
 */
export function unsubscribeUrl(leadId: string): string {
  warnLegacyMint();
  return pageUrl(legacyToken(leadId));
}

/**
 * @deprecated Legacy HMAC link. See `unsubscribeUrl`. Use
 * `listUnsubscribeHeadersFor()` and await it.
 */
export function listUnsubscribeHeaders(leadId: string): Record<string, string> {
  warnLegacyMint();
  return headersFor(legacyToken(leadId));
}

/* ------------------------------------------------------------------ state */

/** Enough to render the confirmation page without exposing the full address. */
export type UnsubscribeState =
  | { status: "invalid" }
  /** Token is well formed but matches no lead. Nothing left to do. */
  | { status: "unknown" }
  | { status: "subscribed"; leadId: string; maskedEmail: string }
  | { status: "already"; leadId: string; maskedEmail: string };

/**
 * `a•••••@gmail.com`. The link arrives in the recipient's own inbox, so showing
 * the address is not a leak to them — but a forwarded or logged URL should not
 * hand over a full address to whoever else sees it. The number of dots is fixed
 * rather than proportional, so the length of the real local part is not a hint
 * either.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "your address";
  return `${email.slice(0, 1)}${"•".repeat(5)}${email.slice(at)}`;
}

const LEAD_SELECT = {
  id: true,
  email: true,
  marketingOptIn: true,
  unsubscribedAt: true,
} as const;

type LeadRow = {
  id: string;
  email: string;
  marketingOptIn: boolean;
  unsubscribedAt: Date | null;
};

type Resolution =
  | { status: "invalid" }
  | { status: "unknown" }
  | { status: "found"; lead: LeadRow };

/**
 * Token to lead. The stored column is the primary match, and that is what makes
 * an already-delivered link outlive a secret rotation; the legacy id path is
 * only ever reached by tokens minted before this change.
 *
 * Read-only on purpose. This runs from a GET, and a GET must never write.
 */
async function resolveLeadByToken(token: string | null | undefined): Promise<Resolution> {
  const shape = classifyUnsubscribeToken(token);
  if (!shape) return { status: "invalid" };

  const lead =
    shape.kind === "stored"
      ? await prisma.lead.findUnique({
          where: { unsubscribeToken: shape.token },
          select: LEAD_SELECT,
        })
      : await prisma.lead.findUnique({ where: { id: shape.leadId }, select: LEAD_SELECT });

  return lead ? { status: "found", lead } : { status: "unknown" };
}

/** Read-only. Safe to call from a GET, which is why it changes nothing. */
export async function readUnsubscribeState(
  token: string | null | undefined,
): Promise<UnsubscribeState> {
  const resolved = await resolveLeadByToken(token);
  if (resolved.status !== "found") return { status: resolved.status };

  const { lead } = resolved;
  const maskedEmail = maskEmail(lead.email);
  return lead.unsubscribedAt || !lead.marketingOptIn
    ? { status: "already", leadId: lead.id, maskedEmail }
    : { status: "subscribed", leadId: lead.id, maskedEmail };
}

/* ------------------------------------------------------------------ write */

export type UnsubscribeSource = "link" | "one-click";

export type UnsubscribeResult =
  | { status: "invalid" }
  | { status: "unknown" }
  | { status: "done"; maskedEmail: string }
  | { status: "already"; maskedEmail: string };

/**
 * Honour an opt-out. Idempotent: calling it twice is not an error, because a
 * mail client that prefetches and a human who then clicks are the normal case.
 *
 * Three writes, and each one is load-bearing:
 *
 *   Lead.marketingOptIn = false     stops the audience query selecting them.
 *   Suppression row                 stops a re-import resurrecting them. The
 *                                   table is keyed by email precisely so it
 *                                   survives the Lead row being replaced.
 *   AuditLog row                    the stored consent record. When someone
 *                                   claims they unsubscribed and still got mail,
 *                                   this is the evidence either way.
 *
 * The opt-out applies to every Lead row sharing the address, not just the one
 * the token names. A person who entered a contest and separately subscribed to
 * the newsletter is two rows and one human, and they asked once.
 */
export async function unsubscribeByToken(
  token: string | null | undefined,
  opts: { source: UnsubscribeSource; ipAddress?: string | null },
): Promise<UnsubscribeResult> {
  const resolved = await resolveLeadByToken(token);
  if (resolved.status !== "found") return { status: resolved.status };

  const { lead } = resolved;
  const alreadyOut = Boolean(lead.unsubscribedAt) && !lead.marketingOptIn;
  const maskedEmail = maskEmail(lead.email);
  const now = new Date();

  await prisma.$transaction([
    prisma.lead.updateMany({
      where: { email: lead.email },
      data: { marketingOptIn: false, unsubscribedAt: lead.unsubscribedAt ?? now },
    }),
    // An existing row is left alone: a HARD_BOUNCE or COMPLAINT already on file
    // is the stronger signal and must not be downgraded to UNSUBSCRIBED.
    prisma.suppression.upsert({
      where: { email: lead.email },
      create: {
        email: lead.email,
        reason: "UNSUBSCRIBED",
        note: `Unsubscribed via ${opts.source} on ${now.toISOString()}`,
      },
      update: {},
    }),
  ]);

  if (!alreadyOut) {
    await prisma.auditLog.create({
      data: {
        userId: null,
        // The recipient is the actor here, not a member of staff.
        userEmail: lead.email,
        action: "lead.unsubscribe",
        entityType: "Lead",
        entityId: lead.id,
        before: { marketingOptIn: lead.marketingOptIn, unsubscribedAt: lead.unsubscribedAt },
        after: { marketingOptIn: false, unsubscribedAt: now, source: opts.source },
        ipAddress: opts.ipAddress ?? null,
      },
    });
  }

  return { status: alreadyOut ? "already" : "done", maskedEmail };
}
