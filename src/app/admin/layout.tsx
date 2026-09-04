import Link from "next/link";
import { getSession } from "@/lib/auth";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/leads", label: "Leads & Entries" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/shows", label: "Shows" },
  { href: "/admin/chatbot", label: "Chatbot" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // The login page renders without the shell. Route protection lives in middleware.ts
  if (!session) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-ink-line bg-ink-soft p-6">
        <p className="font-display text-sm tracking-[0.2em] text-gold">DASHBOARD</p>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-10 text-xs text-white/40">Signed in as {session.name}</p>
      </aside>
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
