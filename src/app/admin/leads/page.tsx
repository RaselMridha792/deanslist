import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <h1 className="font-display text-3xl tracking-wide">Leads &amp; Entries</h1>
      <p className="mt-2 text-sm text-white/50">Showing the 100 most recent submissions.</p>

      <div className="mt-8 overflow-x-auto rounded-xl border border-ink-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-soft text-xs uppercase tracking-widest text-white/50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                  No submissions yet.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-ink-line">
                <td className="px-4 py-3">{lead.firstName} {lead.lastName}</td>
                <td className="px-4 py-3 text-white/70">{lead.email}</td>
                <td className="px-4 py-3 text-white/70">{lead.type}</td>
                <td className="px-4 py-3 text-white/70">{lead.country ?? "-"}</td>
                <td className="px-4 py-3 text-white/70">{lead.status}</td>
                <td className="px-4 py-3 text-white/50">
                  {lead.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
