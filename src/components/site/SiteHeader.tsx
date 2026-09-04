import Link from "next/link";

const nav = [
  { href: "/about", label: "About" },
  { href: "/shows", label: "Shows" },
  { href: "/winners", label: "Winners" },
  { href: "/watch", label: "Watch" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-line/70 bg-ink/85 backdrop-blur">
      <div className="shell flex h-18 items-center justify-between py-4">
        <Link href="/" className="font-display text-xl tracking-[0.2em] text-gold">
          THE DEAN&apos;S LIST
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-medium uppercase tracking-widest text-white/70 transition hover:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="/enter" className="btn-primary !px-5 !py-2.5 text-xs">
          Enter Now
        </Link>
      </div>
    </header>
  );
}
