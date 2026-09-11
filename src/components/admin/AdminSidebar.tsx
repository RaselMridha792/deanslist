"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * The dashboard's navigation: a sidebar on a wide screen, a top bar on a phone.
 *
 * From lg up it is the 240px sunk column it always was. Below that it is one
 * row, the logo and a Menu button, and the links open underneath. The fixed
 * sidebar used to stay 240px wide on a phone, which left the working area about
 * 160px wide and pushed every form field off the right edge. The client runs
 * the show from a phone as often as from a desk.
 *
 * The menu closes itself on navigation. Client-side routing keeps this
 * component mounted, so an open menu would otherwise sit on top of the next
 * page.
 *
 * `children` is the signed-in footer (name, role, sign out), rendered by the
 * server layout and passed through.
 */
export function AdminSidebar({
  role,
  logoSrc,
  children,
}: {
  role: Role;
  logoSrc: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    // The sunk column runs the full page height on a wide screen; the panel
    // inside it sticks. Without the wrapper the column would end at 100vh and
    // the page ground would show beneath it on any long page.
    <div className="bg-admin-sunk lg:w-60 lg:shrink-0">
      <aside className="flex flex-col px-5 py-4 text-admin-text lg:sticky lg:top-0 lg:h-screen lg:py-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-3">
            <img src={logoSrc} alt="Dean's List" className="h-11 w-auto" />
            <span className="text-kicker font-semibold uppercase text-brand-onDark">
              Dashboard
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="admin-menu"
            className="min-h-[44px] border-2 border-admin-line-strong px-4 text-[12px] font-semibold uppercase tracking-[.14em] text-admin-text transition-colors duration-200 ease-dl hover:border-brand-onDark hover:text-brand-onDark lg:hidden"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>

        <div
          id="admin-menu"
          className={cn("flex-col lg:flex lg:min-h-0 lg:flex-1", open ? "flex" : "hidden")}
        >
          <AdminNav role={role} />
          <div className="mt-6 border-t-2 border-admin-line-strong pb-2 pt-5 lg:mt-auto lg:pb-0">
            {children}
          </div>
        </div>
      </aside>
    </div>
  );
}
