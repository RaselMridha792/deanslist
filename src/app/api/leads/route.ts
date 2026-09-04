import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail, entryConfirmationEmail } from "@/lib/mail";

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

  const show = data.showSlug
    ? await prisma.show.findUnique({ where: { slug: data.showSlug } })
    : null;

  const lead = await prisma.lead.create({
    data: {
      type: data.type,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      country: data.country,
      city: data.city,
      talentCategory: data.talentCategory,
      performanceUrl: data.performanceUrl || null,
      stageName: data.stageName,
      ageRange: data.ageRange,
      message: data.message,
      showId: show?.id,
      marketingOptIn: data.marketingOptIn,
      smsOptIn: data.smsOptIn,
      consentAt: data.marketingOptIn ? new Date() : null,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
      referrer: req.headers.get("referer") ?? undefined,
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
      if (process.env.TEAM_NOTIFY_EMAIL) {
        await sendMail({
          to: process.env.TEAM_NOTIFY_EMAIL,
          subject: `New ${lead.type.toLowerCase()} lead: ${lead.firstName} ${lead.lastName ?? ""}`,
          html: `<p>${lead.email} ${lead.phone ?? ""}</p><p>${lead.performanceUrl ?? ""}</p><p>${lead.message ?? ""}</p>`,
          replyTo: lead.email,
        });
      }
    } catch (e) {
      console.error("[lead-mail]", e);
    }
  })();

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
