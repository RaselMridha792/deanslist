import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { unsubscribeByToken, classifyUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * One endpoint, two callers.
 *
 *   RFC 8058 one-click — the URL named by the List-Unsubscribe header. Gmail and
 *   Yahoo POST `List-Unsubscribe=One-Click` to it as form data when someone uses
 *   the unsubscribe control in the mail client's own UI. It must answer 200 and
 *   must not require a further click.
 *
 *   The confirmation page — /unsubscribe/[token] posts here from a plain HTML
 *   form, so the flow works with JavaScript disabled, and gets redirected back
 *   to a rendered result.
 *
 * Nothing happens on GET, ever. Gmail, Outlook and every corporate link scanner
 * prefetch URLs found in mail; a GET that unsubscribed would remove people who
 * never clicked anything.
 */

// node:crypto in @/lib/unsubscribe, and never cache a token response.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().max(400).optional(),
  /** Set to "1" by the confirmation page so it gets HTML back instead of JSON. */
  redirect: z.string().max(4).optional(),
  /** RFC 8058 marker. Present only on a genuine one-click request. */
  "List-Unsubscribe": z.string().max(40).optional(),
  /** Honeypot. See below — on this route it is recorded, not enforced. */
  website: z.string().max(200).optional(),
});

type Body = z.infer<typeof bodySchema>;

async function readBody(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json: unknown = await req.json().catch(() => null);
    if (!json || typeof json !== "object") return {};
    return Object.fromEntries(
      Object.entries(json as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === "string" ? v : "",
      ]),
    );
  }

  // Both urlencoded (one-click, and our form) and multipart land here.
  const form = await req.formData().catch(() => null);
  if (!form) return {};
  return Object.fromEntries(
    Array.from(form.entries()).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  );
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function backToPage(req: NextRequest, token: string, state: string) {
  const url = new URL(`/unsubscribe/${encodeURIComponent(token)}`, req.url);
  url.searchParams.set("state", state);
  // 303 so the browser follows with GET and a refresh cannot re-post the form.
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  /*
   * Two limiters, because the two failure modes are not the same shape.
   *
   * The broad one is a DoS guard only, and it is deliberately loose: a mail
   * provider's one-click requests for an entire campaign arrive from a handful
   * of its own IP addresses, and throttling those would silently drop genuine
   * opt-outs from thousands of different people.
   *
   * The strict one below only counts requests that touched nobody — a token
   * that is not shaped like one we issued, or one that matches no lead. Those
   * are the enumeration attempts. A token that resolves to a lead is proof the
   * request is genuine, so there is nothing left to protect against.
   */
  if (!rateLimit(`unsub:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const raw = await readBody(req);
  const parsed = bodySchema.safeParse(raw);
  const body: Body = parsed.success ? parsed.data : {};

  const token = req.nextUrl.searchParams.get("token") ?? body.token ?? "";
  const wantsHtml = body.redirect === "1";
  const oneClick = body["List-Unsubscribe"] === "One-Click";

  /*
   * The honeypot is recorded but does not block. Every other public POST in this
   * codebase silently drops a request that fills it; unsubscribe is the one
   * place that would be wrong. Refusing to action an opt-out because a hidden
   * field was populated means telling someone they are off the list while
   * leaving them on it, which is the exact failure CAN-SPAM and GDPR care about.
   *
   * Nothing is lost by honouring it: the endpoint is already unforgeable, so an
   * automated request carrying a valid token can only unsubscribe the one
   * recipient whose own email that token came from.
   */
  if (body.website) {
    console.warn(`[unsubscribe] honeypot filled from ${ip}; request honoured anyway`);
  }

  /** Counts a request that changed nothing, and reports when there are too many. */
  const missedTooOften = () => !rateLimit(`unsub-bad:${ip}`, 10, 60_000).ok;

  // Shape first, so junk and truncated links are rejected without a query. This
  // is what a stored random token gives up versus a self-verifying HMAC, and
  // getting it back costs one regex.
  if (!classifyUnsubscribeToken(token)) {
    if (missedTooOften()) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    if (wantsHtml) return backToPage(req, token || "invalid", "invalid");
    return NextResponse.json(
      { ok: false, error: "This unsubscribe link is not valid." },
      { status: 400 },
    );
  }

  const result = await unsubscribeByToken(token, {
    source: oneClick ? "one-click" : "link",
    ipAddress: ip,
  });

  // A well-formed token matching no lead is a miss as well — the row was deleted,
  // or somebody is guessing 256-bit strings. It is counted, but the recipient
  // still gets the honest answer below rather than an error.
  if (result.status === "unknown" && missedTooOften()) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  if (wantsHtml) {
    return backToPage(req, token, result.status === "invalid" ? "invalid" : result.status);
  }

  // RFC 8058: a one-click request must be answered 200 once it has been actioned.
  // "unknown" means the token was well formed but matches no lead, so there is
  // nothing left to remove — still a success from the caller's point of view.
  return NextResponse.json({ ok: true, status: result.status });
}

/**
 * Some clients open the List-Unsubscribe URL in a browser instead of posting to
 * it. Send those to the confirmation page rather than answering 405, and change
 * nothing on the way past.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const url = new URL(`/unsubscribe/${encodeURIComponent(token ?? "invalid")}`, req.url);
  return NextResponse.redirect(url, 302);
}
