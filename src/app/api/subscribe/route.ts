import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { subscribeSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`sub:${ip}`, 5, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = subscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.lead.findFirst({ where: { email } });

  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: { marketingOptIn: true, consentAt: new Date() },
    });
    return NextResponse.json({ ok: true, existing: true });
  }

  await prisma.lead.create({
    data: {
      type: "FAN",
      source: "NEWSLETTER",
      firstName: parsed.data.firstName,
      email,
      country: parsed.data.country,
      marketingOptIn: true,
      consentAt: new Date(),
      ipAddress: ip,

      // Same reasoning as /api/leads: a newsletter signup from an ad is still
      // that ad's result, and the campaign markers reach here from the browser
      // because the request URL no longer carries them.
      utmSource: parsed.data.utmSource,
      utmMedium: parsed.data.utmMedium,
      utmCampaign: parsed.data.utmCampaign,
      utmContent: parsed.data.utmContent,
      utmTerm: parsed.data.utmTerm,
      clickId: parsed.data.clickId,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
