"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; minRole: Role };

/**
 * Grouped so the sidebar stays legible as the dashboard grows. Winners and
 * Gallery were previously unreachable — built, routed, and linked from nowhere,
 * which is indistinguishable from not existing.
 */
const NAV_GROUPS: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [
      { href: "/admin", label: "Overview", minRole: "REVIEWER" },
      { href: "/admin/leads", label: "Leads & Entries", minRole: "REVIEWER" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/shows", label: "Shows & Events", minRole: "EDITOR" },
      { href: "/admin/winners", label: "Winners", minRole: "EDITOR" },
      { href: "/admin/gallery", label: "Gallery", minRole: "EDITOR" },
      { href: "/admin/content", label: "Sponsors & Copy", minRole: "EDITOR" },
    ],
  },
  {
    title: "Audience",
    items: [
      { href: "/admin/segments", label: "Segments", minRole: "EDITOR" },
      { href: "/admin/campaigns", label: "Campaigns", minRole: "EDITOR" },
      { href: "/admin/chatbot", label: "Chatbot", minRole: "EDITOR" },
    ],
  },
  {
    title: "Settings",
    items: [{ href: "/admin/team", label: "Team & Roles", minRole: "OWNER" }],
  },
];

const RANK: Record<Role, number> = { REVIEWER: 1, EDITOR: 2, OWNER: 3 };

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();

  // Hiding a link is cosmetic. Every route re-checks with requireRole() server-side.
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => RANK[role] >= RANK[item.minRole]),
  })).filter((g) => g.items.length > 0);

  return (
    <nav className="mt-8 space-y-6">
      {groups.map((group, gi) => (
        <div key={group.title ?? `g${gi}`}>
          {group.title && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-chalk-ghost">
              {group.title}
            </p>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition-colors duration-base ease-crisp",
                    active
                      ? "bg-gold/10 text-gold"
                      : "text-chalk-muted hover:bg-white/5 hover:text-chalk",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
