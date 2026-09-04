"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";

const NAV: { href: string; label: string; minRole: Role }[] = [
  { href: "/admin", label: "Overview", minRole: "REVIEWER" },
  { href: "/admin/leads", label: "Leads & Entries", minRole: "REVIEWER" },
  { href: "/admin/segments", label: "Segments", minRole: "EDITOR" },
  { href: "/admin/shows", label: "Shows & Events", minRole: "EDITOR" },
  { href: "/admin/content", label: "Content", minRole: "EDITOR" },
  { href: "/admin/campaigns", label: "Campaigns", minRole: "EDITOR" },
  { href: "/admin/chatbot", label: "Chatbot", minRole: "EDITOR" },
  { href: "/admin/team", label: "Team & Roles", minRole: "OWNER" },
];

const RANK: Record<Role, number> = { REVIEWER: 1, EDITOR: 2, OWNER: 3 };

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();

  // Hiding a link is cosmetic. Every route re-checks with requireRole() server-side.
  const visible = NAV.filter((item) => RANK[role] >= RANK[item.minRole]);

  return (
    <nav className="mt-8 space-y-1">
      {visible.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`block rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-gold/10 text-gold"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
