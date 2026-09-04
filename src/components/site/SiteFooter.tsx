import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink-line bg-ink-soft">
      <div className="shell grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-lg tracking-[0.2em] text-gold">THE DEAN&apos;S LIST</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            A global online talent competition. Perform, get voted on, and make the
            Principal&apos;s Roll.
          </p>
        </div>

        <div>
          <p className="label">Explore</p>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link href="/shows" className="hover:text-gold">Shows</Link></li>
            <li><Link href="/winners" className="hover:text-gold">Past Winners</Link></li>
            <li><Link href="/rules" className="hover:text-gold">Rules &amp; Eligibility</Link></li>
          </ul>
        </div>

        <div>
          <p className="label">Connect</p>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link href="/enter" className="hover:text-gold">Enter the Contest</Link></li>
            <li><Link href="/sponsors" className="hover:text-gold">Sponsorship</Link></li>
            <li><Link href="/contact" className="hover:text-gold">Contact</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-line py-6 text-center text-xs text-white/40">
        &copy; {new Date().getFullYear()} Dean&apos;s List LTD. All rights reserved.
      </div>
    </footer>
  );
}
