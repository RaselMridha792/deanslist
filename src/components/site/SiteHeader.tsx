"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Picture } from "@/components/media/Picture";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/about", label: "What is it" },
  { href: "/shows", label: "Shows" },
  { href: "/winners", label: "Winners" },
  { href: "/watch", label: "Watch" },
  { href: "/join", label: "Join the team" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close the panel on navigation, otherwise it survives the route change.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page behind the mobile sheet so it cannot scroll underneath.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-base ease-crisp",
        scrolled || open
          ? "border-ink-line bg-ink/95 backdrop-blur-md"
          : "border-transparent bg-gradient-to-b from-ink/80 to-transparent",
      )}
    >
      <div className="shell flex h-20 items-center justify-between gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label={"The Dean's List — home"}>
          <Picture
            src="/media/brand/logo"
            alt=""
            priority
            width={44}
            height={44}
            className="block h-11 w-11"
            imgClassName="object-contain"
          />
          <span className="hidden font-display text-lg leading-none tracking-[0.18em] text-chalk sm:block">
            THE DEAN&apos;S LIST
          </span>
        </Link>

        <nav className="hidden items-center gap-7 xl:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors duration-base ease-crisp",
                  active ? "text-gold" : "text-chalk-muted hover:text-chalk",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/enter" className="btn-primary !px-5 !py-2.5 !text-xs">
            Enter now
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-11 w-11 place-items-center rounded-full border border-ink-edge text-chalk transition-colors duration-base ease-crisp hover:border-gold hover:text-gold xl:hidden"
          >
            <span className="relative block h-3.5 w-5">
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-full bg-current transition-all duration-base ease-crisp",
                  open ? "top-1.5 rotate-45" : "top-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1.5 block h-0.5 w-full bg-current transition-opacity duration-fast",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-full bg-current transition-all duration-base ease-crisp",
                  open ? "top-1.5 -rotate-45" : "top-3",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile sheet. Most of this audience arrives from Facebook and YouTube
          on a phone, so this is the primary navigation, not an afterthought. */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-ink-line bg-ink xl:hidden"
      >
        <nav className="shell flex flex-col py-4" aria-label="Mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b border-ink-line/60 py-4 font-display text-2xl uppercase tracking-wide text-chalk last:border-0 hover:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
