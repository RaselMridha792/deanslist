import { requireSession } from "@/lib/auth";
import { mediaImage } from "@/lib/media";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
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
    // A column on a wide screen, a stack on a phone: the sidebar becomes a top
    // bar below lg. See AdminSidebar.
    <div className="admin min-h-screen lg:flex">
      <AdminSidebar role={session.role} logoSrc={`${mediaImage("/media/brand/logo")}.png`}>
        <p className="text-[12px] text-admin-muted">{session.name}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-admin-faint">
          {session.role}
        </p>
        <LogoutButton />
      </AdminSidebar>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
