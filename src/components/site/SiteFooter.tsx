import Link from "next/link";
import { Picture } from "@/components/media/Picture";
import { SITE } from "@/content/site";

const COLUMNS = [
  {
    title: "The show",
    links: [
      { href: "/about", label: "What is the Dean's List" },
      { href: "/shows", label: "Shows & events" },
      { href: "/winners", label: "Past winners" },
      { href: "/watch", label: "Watch episodes" },
    ],
  },
  {
    title: "Take part",
    links: [
      { href: "/enter", label: "Enter the contest" },
      { href: "/join", label: "Join the Dean Team" },
      { href: "/sponsors", label: "Sponsorship" },
      { href: "/rules", label: "Rules & eligibility" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

/**
 * Every href here resolves to a real page. The old site carries 42 dead
 * `href="#"` links and six `skype:#?chat` links that go nowhere; not shipping
 * any is a stated goal of the rebuild.
 */
export function SiteFooter() {
  return (
    <footer className="mt-section border-t border-ink-line bg-ink-raised">
      <div className="shell py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <Picture
                src="/media/brand/logo"
                alt=""
                width={48}
                height={48}
                className="block h-12 w-12"
                imgClassName="object-contain"
              />
              <span className="font-display text-lg leading-none tracking-[0.18em] text-chalk">
                THE DEAN&apos;S LIST
              </span>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-chalk-muted">
              {SITE.description}
            </p>

            <div className="mt-6 flex gap-3">
              <SocialLink href={SITE.socials.youtube} label="YouTube">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
              </SocialLink>
              <SocialLink href={SITE.socials.facebook} label="Facebook">
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96H15.83c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
              </SocialLink>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="eyebrow">{col.title}</p>
              <ul className="mt-4 space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-chalk-muted transition-colors duration-base ease-crisp hover:text-gold"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 rule-gold" />

        <div className="mt-8 flex flex-col gap-4 text-xs text-chalk-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {SITE.legalName}. All rights reserved.
          </p>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>
              {SITE.address.line1}, {SITE.address.city}, {SITE.address.state}{" "}
              {SITE.address.postalCode}
            </span>
            <a
              href={`mailto:${SITE.email}`}
              className="transition-colors duration-base ease-crisp hover:text-gold"
            >
              {SITE.email}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full border border-ink-edge text-chalk-muted transition-colors duration-base ease-crisp hover:border-gold hover:text-gold"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden>
        {children}
      </svg>
    </a>
  );
}
