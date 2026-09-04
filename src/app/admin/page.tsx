import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [total, contestants, subscribers, last7] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { type: "CONTESTANT" } }),
    prisma.lead.count({ where: { marketingOptIn: true } }),
    prisma.lead.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const cards = [
    { label: "Total leads", value: total },
    { label: "Contest entries", value: contestants },
    { label: "Email subscribers", value: subscribers },
    { label: "New in last 7 days", value: last7 },
  ];

  return (
    <>
      <h1 className="font-display text-3xl tracking-wide">Overview</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-ink-line bg-ink-soft p-5">
            <p className="text-xs uppercase tracking-widest text-white/50">{c.label}</p>
            <p className="mt-2 font-display text-4xl text-gold">{c.value}</p>
          </div>
        ))}
      </div>
    </>
  );
}
