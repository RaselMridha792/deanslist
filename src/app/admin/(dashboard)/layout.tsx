import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/admin/LogoutButton";

/**
 * Everything inside the (dashboard) route group is authenticated. The login page
 * lives at src/app/admin/login and is deliberately OUTSIDE this group, so this
 * layout can hard-require a session without creating a redirect loop.
 *
 * The previous version returned `<>{children}</>` when there was no session,
 * which rendered admin pages — including the full lead table — to anyone who
 * got past middleware.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-ink-line bg-ink-soft p-6">
        <Link href="/admin" className="font-display text-sm tracking-[0.2em] text-brand">
          DASHBOARD
        </Link>

        <AdminNav role={session.role} />

        <div className="mt-auto pt-10">
          <p className="text-xs text-white/40">Signed in as {session.name}</p>
          <p className="text-[11px] uppercase tracking-widest text-white/25">{session.role}</p>
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1 p-8">{children}</div>
    </div>
  );
}
