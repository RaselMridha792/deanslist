import Link from "next/link";
import { SITE, SHOWS } from "@/content/site";

/**
 * Direct info. No form, no model, no waiting — the tab for someone who already
 * knows what they want.
 *
 * Every fact here comes from src/content/site.ts, which carries only what the
 * old site actually states. Show dates and prize amounts are deliberately
 * absent: the old site contradicts itself on the date and the client has not
 * confirmed either, so this tab says where dates are announced instead of
 * guessing one. See docs/PROJECT-BRIEF.md section 8.
 */

const ROUTES = [
  { href: "/shows", label: "Shows and formats", note: "How each show works" },
  { href: "/watch", label: "Watch episodes", note: "Performances and highlights" },
  { href: "/winners", label: "Winners", note: "The Principal's Roll" },
  { href: "/rules", label: "Contest rules", note: "Eligibility and prize terms" },
  { href: "/sponsors", label: "Sponsorship", note: "Brand and partner packages" },
  { href: "/join", label: "Join the team", note: "Judges, hosts and crew" },
  { href: "/contact", label: "Press and media", note: "Interviews, assets, coverage" },
];

export function InfoTab() {
  return (
    <div className="space-y-8">
      <section>
        <p className="eyebrow">Where it happens</p>
        <p className="mt-2 text-sm text-chalk-muted">
          Shows are broadcast live on both channels. Dates are announced there first, and to
          the email list.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <a
            href={SITE.socials.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="card-interactive px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-chalk"
          >
            YouTube
          </a>
          <a
            href={SITE.socials.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="card-interactive px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-chalk"
          >
            Facebook
          </a>
        </div>
      </section>

      <section>
        <p className="eyebrow">The shows</p>
        <ul className="mt-4 space-y-3">
          {SHOWS.map((show) => (
            <li key={show.slug} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/shows/${show.slug}`}
                  className="font-display text-lg uppercase tracking-wide text-chalk transition-colors duration-base ease-crisp hover:text-brand"
                >
                  {show.title}
                </Link>
                <span className="badge shrink-0">{show.status.toLowerCase()}</span>
              </div>
              <p className="mt-2 text-sm text-chalk-muted">{show.tagline}</p>
              {show.cadence && (
                <p className="mt-2 text-xs uppercase tracking-widest text-brand">{show.cadence}</p>
              )}
            </li>
          ))}
        </ul>
        <p className="help">
          No confirmed next date is published yet. Follow a channel or join the list and it
          reaches you as soon as it is set.
        </p>
      </section>

      <section>
        <p className="eyebrow">Talk to the team</p>
        <a
          href={`mailto:${SITE.email}`}
          className="mt-3 block break-words text-sm font-semibold text-brand transition-opacity hover:opacity-80"
        >
          {SITE.email}
        </a>
        <p className="mt-1 text-xs text-chalk-faint">{SITE.location}</p>
      </section>

      <section>
        <p className="eyebrow">Everything else</p>
        <ul className="mt-3 divide-y divide-ink-line overflow-hidden rounded-card border border-ink-line">
          {ROUTES.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="flex items-center justify-between gap-4 bg-ink-soft px-4 py-3 transition-colors duration-base ease-crisp hover:bg-ink-high"
              >
                <span>
                  <span className="block text-sm font-medium text-chalk">{r.label}</span>
                  <span className="block text-xs text-chalk-faint">{r.note}</span>
                </span>
                <span aria-hidden="true" className="text-brand"></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
