import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { SITE } from "@/content/site";

export const metadata: Metadata = {
  title: "Rules & Eligibility",
  description:
    "Official contest rules, eligibility, judging and prize terms for Dean's List competitions.",
  // Not indexed until the client's official wording replaces the outline below.
  robots: { index: false, follow: true },
};

/**
 * Contest rules are a legal document, not copy. Eligibility, minors, prize
 * liability and the judging basis all carry real exposure for a company running
 * a public prize competition, so nothing here is drafted on the client's behalf.
 *
 * This page ships as an honest outline that says so, and swaps to the real
 * wording via PageSection once the client supplies it. It is noindex until then.
 * Tracked in docs/PROJECT-BRIEF.md section 8.
 */

const OUTLINE = [
  {
    heading: "Who can enter",
    body: "Eligible countries, minimum age, and whether entrants under 18 may take part with guardian consent.",
  },
  {
    heading: "How to enter",
    body: "What counts as a valid submission, the accepted formats for a performance, and the entry deadline for each show.",
  },
  {
    heading: "Judging and voting",
    body: "How the audience vote and the judges' scoring combine, what the judges assess, and how ties are settled.",
  },
  {
    heading: "The prize",
    body: "Prize amount per show, how and when it is paid, currency, and who is responsible for any tax.",
  },
  {
    heading: "Your performance",
    body: "Who owns a submitted performance, what rights the entrant grants for it to be broadcast, and the position on music the entrant does not own.",
  },
  {
    heading: "Disqualification",
    body: "Grounds for removing an entry, and the appeal route if an entrant disputes a decision.",
  },
];

export default function RulesPage() {
  return (
    <>
      <PageHero
        eyebrow="Rules & eligibility"
        title="Official contest rules"
        lede="The full terms for entering a Dean's List competition."
      />

      <section className="section">
        <div className="shell max-w-3xl">
          <div className="rounded-card border border-live/30 bg-live/5 p-7">
            <p className="text-sm font-semibold uppercase tracking-widest text-live">
              Awaiting official wording
            </p>
            <p className="mt-3 leading-relaxed text-chalk-body">
              These rules are being finalised with Dean&apos;s List LTD. The outline below
              shows what the published terms will cover. Nothing here is drafted or binding
              yet — for anything you need confirmed before entering, email{" "}
              <a href={`mailto:${SITE.email}`} className="text-brand hover:underline">
                {SITE.email}
              </a>{" "}
              and the team will answer directly.
            </p>
          </div>

          <div className="mt-14 space-y-px overflow-hidden rounded-card border border-ink-line bg-ink-line">
            {OUTLINE.map((s, i) => (
              <section key={s.heading} className="bg-ink-soft p-8">
                <p className="font-display text-3xl leading-none text-chalk-ghost">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-4 text-xl uppercase tracking-wide">{s.heading}</h2>
                <p className="mt-3 leading-relaxed text-chalk-muted">{s.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-14">
            <ButtonLink href="/enter" size="lg">
              Enter the contest
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
