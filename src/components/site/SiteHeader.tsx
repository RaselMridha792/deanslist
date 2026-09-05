"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { mediaImage } from "@/lib/media";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/about", label: "What is it" },
  { href: "/shows/drop-that-mike", label: "Shows" },
  { href: "/winners", label: "Winners" },
  { href: "/watch", label: "Watch" },
  { href: "/join", label: "Join the team" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact" },
];

/**
 * Sticky header on ink, 2px bottom rule, grid auto / 1fr / auto.
 *
 * The nav collapses to a Menu button below 1100px. That threshold is a CSS
 * media query rather than a JS width check on purpose: a JS breakpoint renders
 * the desktop nav on the server, then swaps after hydration, which is a visible
 * flash on every page load. Both are in the DOM and CSS decides.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b-2 border-rule-dark bg-ink text-ground">
        <div className="mx-auto grid max-w-shell grid-cols-[auto_1fr_auto] items-center gap-8 px-gutter py-[14px]">
          <Link href="/" className="flex items-center gap-3" aria-label="The Dean's List, home">
            <img
              src={`${mediaImage("/media/brand/logo")}.png`}
              alt="Dean's List"
              className="h-[34px] w-auto"
            />
          </Link>

          {/* Below 1100px this becomes the Menu button; above it, the full nav. */}
          <div className="flex justify-center min-[1100px]:hidden">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="dl-menu"
              className="flex items-center gap-[10px] border-2 border-ground/30 px-[14px] py-2 text-nav font-semibold uppercase transition-colors hover:border-brand"
            >
              <span
                aria-hidden
                className="inline-block h-[2px] w-4 bg-current"
                style={{ boxShadow: "0 5px 0 currentColor, 0 -5px 0 currentColor" }}
              />
              {open ? "Close" : "Menu"}
            </button>
          </div>

          <nav
            className="hidden justify-center gap-[clamp(12px,1.6vw,32px)] text-nav font-semibold uppercase min-[1100px]:flex"
            aria-label="Main"
          >
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap transition-colors duration-200 ease-dl hover:text-brand-onDark",
                    active ? "text-brand-onDark opacity-100" : "opacity-80 hover:opacity-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-5">
            <div className="hidden items-center gap-2 text-eyebrow font-semibold uppercase sm:flex">
              <span aria-hidden className="inline-block h-2 w-2 animate-dl-pulse bg-brand" />
              Entries open
            </div>
            <Link href="/enter" className="btn btn-primary">
              Enter now
            </Link>
          </div>
        </div>
      </header>

      {/* Full-width dropdown, auto-fit 200px columns. */}
      <div
        id="dl-menu"
        hidden={!open}
        className="sticky top-[66px] z-[49] border-b-2 border-rule-dark bg-ink text-ground min-[1100px]:hidden"
      >
        <nav
          className="mx-auto grid max-w-shell grid-cols-[repeat(auto-fit,minmax(200px,1fr))] px-gutter pb-4 pt-2 text-[13px] font-semibold uppercase tracking-[.12em]"
          aria-label="Mobile"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b border-ground/20 py-[14px] transition-colors hover:text-brand-onDark"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
