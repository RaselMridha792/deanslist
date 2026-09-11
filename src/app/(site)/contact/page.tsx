import type { Metadata } from "next";

import { ButtonLink } from "@/components/dl/Button";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { SITE } from "@/content/site";
import { cn } from "@/lib/cn";
import { getSiteLinks } from "@/lib/settings";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "General questions, press, sponsorship and support. Talent goes to the producer, business to the CEO.",
  alternates: { canonical: "/contact" },
};

// The channel links come from the dashboard, so this renders per request.
export const dynamic = "force-dynamic";

/**
 * Contact — the routed inquiry page.
 *
 * The old site's "Contact Us" is one of 42 `href="#"` links and goes nowhere.
 * This is the page that has to exist for the rebuild to mean anything.
 *
 * The whole page used to be a Client Component, which cost it its own title
 * and description, and made the channel links impossible to read from the
 * dashboard. Only the form needs state, so only the form is a client module
 * now (./ContactForm). Both came back with the split.
 */

/**
 * The handle a social URL ends in: "@deanslistllc", "Deanslistltd2025".
 *
 * Derived rather than typed out twice, so the label cannot drift from the link
 * it points at when the client edits it in the dashboard.
 */
function handleOf(url: string): string {
  return url.replace(/\/+$/, "").split("/").pop() ?? url;
}

/** Shared by the detail rows. One clamp, declared once. */
const DETAIL_VALUE =
  "font-extrabold leading-[1.3] tracking-[-.02em] text-[clamp(16px,1.3vw,20px)]";

export default async function ContactPage() {
  const links = await getSiteLinks();

  /**
   * Two addresses, by the client's own rule: talent and referrals to the
   * producer, business deals and ownership to the CEO and nowhere else. The
   * Sponsorship route on the form follows the same rule for notifications.
   *
   * Instagram appears only once it is set in the dashboard. A button linking
   * nowhere is worse than no button.
   */
  const details: { label: string; value: string; href?: string }[] = [
    { label: "Talent", value: SITE.email, href: `mailto:${SITE.email}` },
    { label: "Business", value: SITE.businessEmail, href: `mailto:${SITE.businessEmail}` },
    {
      label: "Studio",
      value: `${SITE.address.line1}, ${SITE.address.city}, ${SITE.address.state} ${SITE.address.postalCode}`,
    },
    { label: "YouTube", value: handleOf(links.youtube), href: links.youtube },
    { label: "Facebook", value: handleOf(links.facebook), href: links.facebook },
    ...(links.instagram
      ? [{ label: "Instagram", value: handleOf(links.instagram), href: links.instagram }]
      : []),
  ];

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-ink text-ground">
        <div className="shell grid items-end gap-8 pb-[clamp(40px,5vw,72px)] pt-[clamp(56px,7vw,120px)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="animate-dl-rise">
            <Kicker onDark>Contact</Kicker>
            <h1 className="mt-5 text-hero font-extrabold uppercase text-balance">
              Talk to the team.
            </h1>
          </div>
          {/* Delay is inline, not a utility: `animate-dl-rise` is the animation
              shorthand, so a class-based delay is a coin toss on source order. */}
          <p
            className="animate-dl-rise max-w-[44ch] text-lede text-ground/85 text-pretty"
            style={{ animationDelay: "200ms" }}
          >
            General questions, press, sponsorship and support. Pick a route so it lands with the
            right person.
          </p>
        </div>
      </section>

      {/* --------------------------------------------- details and inquiry */}
      <section className="shell py-section">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-24">
          {/*
            The rules between rows are a 2px gap over a rule-coloured background,
            not per-row borders — the same construction as CellGrid, so the last
            row carries no trailing rule and needs no override.
          */}
          <Reveal className="flex flex-col gap-[2px] border-t-2 border-rule bg-rule">
            {details.map((d) => (
              <div key={d.label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 bg-ground py-5">
                <span className="pt-1 text-eyebrow uppercase text-neutral-600">{d.label}</span>
                {d.href ? (
                  /*
                    The negative margin buys the 44px tap target the handoff asks
                    for without adding 20px to the row: the link's box grows, the
                    row's rhythm does not.
                  */
                  <a
                    href={d.href}
                    {...(d.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className={cn(
                      DETAIL_VALUE,
                      "-my-[10px] inline-flex items-center break-words py-[10px] transition-colors duration-200 ease-dl hover:text-brand-onLight",
                    )}
                  >
                    {d.value}
                  </a>
                ) : (
                  <span className={DETAIL_VALUE}>{d.value}</span>
                )}
              </div>
            ))}

            {/*
              Last row of the same stack, so the 2px rule above it comes free.
              Contest entries have their own four-step funnel and their own
              schema fields; a message typed into this box would arrive with none
              of them, so the page says so before anyone starts typing.
            */}
            <div className="bg-ink p-[clamp(20px,2.5vw,32px)] text-ground">
              <Kicker onDark className="mb-2.5">
                Want to perform?
              </Kicker>
              <p className="mb-4 text-body text-ground/85">
                Contestant entries do not go through this form.
              </p>
              <ButtonLink href="/enter" size="lg">
                Enter the contest
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal index={1}>
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
