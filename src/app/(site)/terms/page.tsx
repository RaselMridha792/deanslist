import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { SITE } from "@/content/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms governing use of the Dean's List website.",
  robots: { index: false, follow: true },
};

/**
 * Website terms only. Contest terms are a separate document and live on /rules,  * conflating the two is how a prize competition ends up with unenforceable rules.
 * Both need the client's sign-off; neither is drafted here.
 */
const SECTIONS = [
  {
    heading: "Using this site",
    body: "You may browse the site, enter competitions, and contact us through the forms provided. Do not attempt to disrupt the service, submit automated entries, or misuse the forms.",
  },
  {
    heading: "Contest terms are separate",
    body: "Entering a competition is governed by the official contest rules, not by this page. Those cover eligibility, judging, prizes and the rights in a submitted performance.",
    link: { href: "/rules", label: "Read the contest rules" },
  },
  {
    heading: "What you submit",
    body: "You are responsible for having the right to submit whatever you send us, including any music used in a performance. The rights position for submitted performances is set out in the contest rules.",
  },
  {
    heading: "Content on this site",
    body: "Show names, logos, footage and photography on this site belong to Dean's List LTD or its licensors. Do not reuse them commercially without permission.",
  },
  {
    heading: "Links away from here",
    body: "This site links to YouTube and Facebook. What happens on those platforms is governed by their terms, not ours.",
  },
  {
    heading: "Changes",
    body: "These terms may be updated. The version published here is the one that applies.",
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of use"
        lede="The terms that apply to using this website."
      />

      <section className="section">
        <div className="shell">
          <div className="max-w-[68ch]">
            <div className="border-l-4 border-brand bg-brand-tint p-6">
              <p className="kicker">Pending legal review</p>
              <p className="mt-3 text-body text-neutral-800">
                An outline pending sign-off by {SITE.legalName}. Liability,
                governing law and jurisdiction are deliberately not stated here
                until confirmed.
              </p>
            </div>

            <div className="divider mt-14 space-y-12 pt-12">
              {SECTIONS.map((s) => (
                <section key={s.heading}>
                  <h2 className="text-display-sm font-extrabold">
                    {s.heading}
                  </h2>
                  <p className="mt-4 text-pretty text-body text-neutral-700">
                    {s.body}
                  </p>
                  {s.link && (
                    <Link href={s.link.href} className="btn-quiet mt-4">
                      {s.link.label}
                    </Link>
                  )}
                </section>
              ))}

              <section>
                <h2 className="text-display-sm font-extrabold">Contact</h2>
                <p className="mt-4 text-pretty text-body text-neutral-700">
                  {SITE.legalName}, {SITE.location}.{" "}
                  <a
                    href={`mailto:${SITE.email}`}
                    className="text-brand-onLight underline underline-offset-4"
                  >
                    {SITE.email}
                  </a>
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
