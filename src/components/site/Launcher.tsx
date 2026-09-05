"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The fixed "Enter / Ask" block, bottom right.
 *
 * This is the mount point for the engagement centre described in the signed
 * scope: entry form, guided chat, direct info. The panel and its trigger are
 * both ChatWidget, which positions itself; this wrapper owns only WHEN the
 * launcher is allowed to be seen. Opacity and pointer-events apply to the whole
 * subtree, fixed descendants included, so wrapping is enough to hide it.
 *
 * Three visibility rules from the handoff, each with a reason:
 *
 *   hidden on /enter      the page is already the entry form, so a floating
 *                         "Enter" button competes with the thing it points at
 *   hidden on /thank-you  nothing left to convert
 *   homepage: after hero  the hero carries its own entry form. Showing the
 *                         launcher over it duplicates the call to action at the
 *                         exact moment it is least needed.
 */
export function Launcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    if (!isHome) return;

    const check = () => setPastHero(window.scrollY > window.innerHeight * 0.85);
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [isHome]);

  if (pathname.startsWith("/enter") || pathname.startsWith("/thank-you")) return null;

  const visible = !isHome || pastHero;

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[60] transition-opacity duration-300 ease-dl",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      // Hidden from the accessibility tree while it is invisible, so a keyboard
      // user does not tab into a button they cannot see. React 19 takes a real
      // boolean here; the empty-string form is the pre-19 spelling and warns.
      aria-hidden={!visible}
      inert={!visible}
    >
      {children}
    </div>
  );
}
