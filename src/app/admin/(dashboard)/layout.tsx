import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { mediaImage } from "@/lib/media";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/admin/LogoutButton";

/**
 * Everything inside the (dashboard) route group is authenticated. The login page
 * lives at src/app/admin/login and is deliberately OUTSIDE this group, so this
 * layout can hard-require a session without creating a redirect loop.
 *
 * An earlier version returned `<>{children}</>` when there was no session, which
 * rendered admin pages — including the full lead table — to anyone who got past
 * middleware.
 *
 * The dashboard runs the admin dark scale: near-black ground, red, radius 0,
 * 2px rules. It is the same product and should not feel like a different one.
 * What differs is density, not language: the sidebar is admin-sunk so the
 * working area reads as the page, and panels sit on admin-panel so a table
 * separates from the ground without needing a shadow.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="admin flex min-h-screen">
      {/* The sunk column runs the full page height; the panel inside it sticks.
          Without the wrapper the column ends at 100vh and the page ground shows
          beneath it on any page longer than the viewport, which reads as a
          rendering fault. */}
      <div className="w-60 shrink-0 bg-admin-sunk">
        <aside className="sticky top-0 flex h-screen flex-col px-5 py-6 text-admin-text">
          <Link href="/admin" className="flex items-center gap-3">
            <img
              src={`${mediaImage("/media/brand/logo")}.png`}
              alt="Dean's List"
              className="h-11 w-auto"
            />
            <span className="text-kicker font-semibold uppercase text-brand-onDark">
              Dashboard
            </span>
          </Link>

          <AdminNav role={session.role} />

          <div className="mt-auto border-t-2 border-admin-line-strong pt-5">
            <p className="text-[12px] text-admin-muted">{session.name}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-admin-faint">
              {session.role}
            </p>
            <LogoutButton />
          </div>
        </aside>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-6 py-10 lg:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
