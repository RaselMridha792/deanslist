import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail, entryConfirmationEmail } from "@/lib/mail";

/**
 * Whatever a stranger typed into a public form, made safe to put inside the
 * HTML of the team's notification email. A message reading <img src=x
 * onerror=…> arrives as those characters, not as markup.
 */
function esc(value: string | null | undefined): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return (value ?? "").replace(/[&<>"']/g, (c) => map[c]);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`lead:${ip}`, 5, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many submissions. Try again shortly." }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = leadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // honeypot filled means bot
  if (data.website) return NextResponse.json({ ok: true });

  // The entry funnel requires both consents before it will submit, but that is
  // a browser prompt, not a guarantee: a crafted POST skips it. Broadcast
  // consent is the permission to put someone's performance on YouTube and
  // Facebook, so an entry without it is refused here rather than stored and
  // sorted out later.
  if (data.type === "CONTESTANT" && !(data.rulesAccepted && data.broadcastConsent)) {
    return NextResponse.json(
      { error: "A contest entry needs both the rules and the broadcast consent." },
      { status: 400 },
    );
  }

  const show = data.showSlug
    ? await prisma.show.findUnique({ where: { slug: data.showSlug } })
    : null;

  /*
   * The campaign this entry came from, if any.
   *
   * Resolved against campaigns the public can actually SEE, not merely against
   * the slug column. A draft campaign is one nobody has been shown a form for,
   * so an entry claiming to come from one did not come from a form at all, and
   * attaching it would put entries against a contest that has not launched.
   *
   * A slug that matches nothing is dropped rather than rejected: the entry
   * itself is still a real person who filled in a real form, and losing them
   * over a stale link would be the worse failure.
   */
  const promotion = data.promotionSlug
    ? await prisma.promotion.findFirst({
        where: { slug: data.promotionSlug, status: { in: ["RUNNING", "ENDED"] } },
        select: { id: true },
      })
    : null;

  const lead = await prisma.lead.create({
    data: {
      type: data.type,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      promotionId: promotion?.id,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
      talentCategory: data.talentCategory,
      performanceUrl: data.performanceUrl || null,
      stageName: data.stageName,
      ageRange: data.ageRange,
      message: data.message,
      showId: show?.id,
      marketingOptIn: data.marketingOptIn,
      smsOptIn: data.smsOptIn,
      consentAt: data.marketingOptIn ? new Date() : null,
      // Stamped with the moment given, not a boolean: "they agreed" is worth
      // far less than "they agreed at this time" if it is ever questioned.
      rulesAcceptedAt: data.rulesAccepted ? new Date() : null,
      broadcastConsentAt: data.broadcastConsent ? new Date() : null,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
      referrer: req.headers.get("referer") ?? undefined,

      // Campaign markers, captured by the browser on the landing page. They
      // cannot be read from this request: by the time a visitor submits, the
      // URL is /enter and the utm_* that paid for them is two pages behind.
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmContent: data.utmContent,
      utmTerm: data.utmTerm,
      clickId: data.clickId,
    },
  });

  // fire and forget, never block the response on email
  void (async () => {
    try {
      await sendMail({
        to: lead.email,
        subject: "We received your entry",
        html: entryConfirmationEmail(lead.firstName, show?.title),
      });
      // The client's routing: business to the CEO, everything else to the
      // producer. A sponsor lead falls back to the team address when no
      // business address is configured, so it is never silently dropped.
      const notifyTo =
        lead.type === "SPONSOR"
          ? process.env.BUSINESS_NOTIFY_EMAIL || process.env.TEAM_NOTIFY_EMAIL
          : process.env.TEAM_NOTIFY_EMAIL;
      if (notifyTo) {
        await sendMail({
          to: notifyTo,
          subject: `New ${lead.type.toLowerCase()} lead: ${lead.firstName} ${lead.lastName ?? ""}`,
          html: `<p>${esc(lead.email)} ${esc(lead.phone)}</p><p>${esc(lead.performanceUrl)}</p><p>${esc(lead.message)}</p>`,
          replyTo: lead.email,
        });
      }
    } catch (e) {
      console.error("[lead-mail]", e);
    }
  })();

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
