import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { LeadForm } from "@/components/forms/LeadForm";
import { SITE, INQUIRY_TYPES } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Dean's List LTD — general enquiries, press, sponsorship and contest support.",
};

const ROUTES = [
  { label: "Contest support", body: "Questions about entering, your submission, or judging." },
  { label: "Press & media", body: "Interviews, assets, and coverage requests." },
  { label: "Sponsorship", body: "Brand partnerships and season packages.", href: "/sponsors" },
  { label: "Join the team", body: "Judges, hosts, crew and collaborators.", href: "/join" },
];

/**
 * The old site's "Contact Us" is one of 42 `href="#"` links and goes nowhere.
 * This is the page that has to exist for the rebuild to mean anything.
 */
export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        lede="Every message reaches the team directly. Pick the route that fits and we will come back to you."
      />

      <section className="section">
        <div className="shell grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div>
            <p className="eyebrow">Direct</p>
            <a
              href={`mailto:${SITE.email}`}
              className="mt-4 block break-words font-display text-3xl uppercase tracking-wide text-brand transition-opacity hover:opacity-80"
            >
              {SITE.email}
            </a>
            <address className="mt-3 not-italic text-sm leading-relaxed text-chalk-faint">
              {SITE.address.line1}
              <br />
              {SITE.address.city}, {SITE.address.state} {SITE.address.postalCode}
            </address>

            <div className="mt-10 flex gap-3">
              <a
                href={SITE.socials.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost !px-5 !py-2.5 !text-xs"
              >
                YouTube
              </a>
              <a
                href={SITE.socials.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost !px-5 !py-2.5 !text-xs"
              >
                Facebook
              </a>
            </div>

            <div className="mt-14 space-y-px overflow-hidden rounded-card border border-ink-line bg-ink-line">
              {ROUTES.map((r) => {
                const inner = (
                  <>
                    <p className="text-sm font-semibold uppercase tracking-wide text-chalk">
                      {r.label}
                    </p>
                    <p className="mt-1.5 text-sm text-chalk-muted">{r.body}</p>
                  </>
                );
                return r.href ? (
                  <Link
                    key={r.label}
                    href={r.href}
                    className="block bg-ink-soft p-6 transition-colors duration-base ease-crisp hover:bg-ink-high"
                  >
                    {inner}
                    <span className="mt-3 inline-block text-xs uppercase tracking-widest text-brand">
                      Go to page →
                    </span>
                  </Link>
                ) : (
                  <div key={r.label} className="bg-ink-soft p-6">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-card border border-ink-line bg-ink-soft p-7 sm:p-9">
            <p className="eyebrow">Send a message</p>
            <h2 className="mt-3 text-2xl uppercase tracking-wide">How can we help?</h2>

            <div className="mt-8">
              <LeadForm
                type="GENERAL"
                fields={["firstName", "lastName", "email", "country", "inquiryType", "message"]}
                inquiryOptions={INQUIRY_TYPES}
                submitLabel="Send message"
                messageLabel="Your message"
                consentLabel="Also send me show announcements and reminders."
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
