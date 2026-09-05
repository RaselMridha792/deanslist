import Link from "next/link";
import { mediaImage } from "@/lib/media";
import { SITE } from "@/content/site";

const COLUMNS = [
  {
    title: "The show",
    links: [
      { href: "/about", label: "What is it" },
      { href: "/shows/drop-that-mike", label: "Drop That Mike" },
      { href: "/winners", label: "Winners" },
      { href: "/watch", label: "Watch" },
    ],
  },
  {
    title: "Take part",
    links: [
      { href: "/enter", label: "Enter the contest" },
      { href: "/join", label: "Join the team" },
      { href: "/sponsors", label: "Sponsors" },
      { href: "/rules", label: "Rules" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

/**
 * Black footer, four columns at 2fr 1fr 1fr 1fr.
 *
 * Every href resolves to a real page. The old site ships 42 dead `href="#"`
 * links and six `skype:#?chat` links; a smoke test asserts zero here.
 */
export function SiteFooter() {
  return (
    <footer className="bg-ink text-ground">
      <div className="shell py-section">
        <div className="grid gap-12 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center">
              <img
                src={`${mediaImage("/media/brand/logo")}.png`}
                alt="Dean's List"
                className="h-10 w-auto"
              />
            </Link>

            <p className="mt-6 max-w-sm text-body text-ground/70">{SITE.description}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={SITE.socials.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-dark"
              >
                YouTube
              </a>
              <a
                href={SITE.socials.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-dark"
              >
                Facebook
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-kicker font-semibold uppercase text-brand-onDark">{col.title}</p>
              <ul className="mt-5 space-y-3 text-body">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-ground/70 transition-colors duration-200 ease-dl hover:text-brand-onDark"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t-2 border-rule-dark pt-8">
          <div className="flex flex-col gap-4 text-[12px] text-ground/60 sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; 2026 {SITE.legalName}</p>
            <p className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span>
                {SITE.address.line1}, {SITE.address.city}, {SITE.address.state}{" "}
                {SITE.address.postalCode}
              </span>
              <a
                href={`mailto:${SITE.email}`}
                className="transition-colors hover:text-brand-onDark"
              >
                {SITE.email}
              </a>
            </p>
            <p className="flex gap-6">
              <Link href="/privacy" className="transition-colors hover:text-brand-onDark">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-brand-onDark">
                Terms
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
