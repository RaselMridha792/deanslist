import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { SITE } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What data the Dean's List website collects, why, and how to have it removed.",
};

/**
 * A factual description of what this application actually does with personal
 * data, not invented legal boilerplate. Every claim below is true of the code
 * as built and can be checked against src/app/api/leads/route.ts and the Prisma
 * schema.
 *
 * The legal framing (registered entity, controller details, jurisdiction,
 * retention periods) is the client's to supply and should be reviewed before
 * launch. The review banner stays until that happens.
 *
 * This page is not optional: the old site runs GA4 and a Meta Pixel with no
 * consent mechanism and the word "privacy" appears nowhere on it, and an email
 * service provider will ask for this URL before approving bulk sending.
 */

const SECTIONS = [
  {
    heading: "What we collect",
    body: [
      "When you enter a contest we collect the name, email address, and any phone number, country, stage name, talent category and performance link you submit, along with anything you write in the message field.",
      "When you subscribe to announcements we collect your first name and email address.",
      "When you contact us, apply to the Dean Team, or make a sponsorship enquiry we collect what you enter on that form.",
      "With every submission we also record the IP address it came from, your browser's user agent string, and the page that referred you. This is kept to detect and block automated abuse.",
    ],
  },
  {
    heading: "Why we collect it",
    body: [
      "To review your entry, contact you about it, and run the competition.",
      "To answer enquiries you send us.",
      "To send show announcements, entry deadlines and results, but only if you ticked the box asking for them. Consent is recorded with a timestamp at the moment you give it.",
      "To keep the forms working and free of spam.",
    ],
  },
  {
    heading: "Marketing email",
    body: [
      "We only send marketing email to people who asked for it. Every such email carries a one-click unsubscribe link, and unsubscribing takes effect immediately.",
      "If your address hard-bounces or you mark a message as spam, we add it to a suppression list and stop sending, permanently.",
      "We do not sell, rent or share your email address with third parties.",
    ],
  },
  {
    heading: "Who can see your data",
    body: [
      "Named members of the Dean's List team, through a password-protected admin dashboard with role-based access.",
      "The email provider that delivers our messages, and the hosting and database providers that run this site.",
      "We do not pass your details to advertisers.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "You can ask for a copy of the data we hold about you, ask us to correct it, or ask us to delete it.",
      "You can withdraw consent for marketing at any time, either through the unsubscribe link or by emailing us.",
      "To exercise any of these, email us and we will action it.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "This site sets one cookie, and only for signed-in administrators: a session cookie that keeps them logged in to the dashboard.",
      "The public site sets no advertising or analytics cookies. If analytics is added later, it will be behind a consent banner and this page will be updated first.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy policy"
        lede="What this site collects, why, and how to get it removed."
      />

      <section className="section">
        <div className="shell max-w-3xl">
          <div className="rounded-card border border-brand/30 bg-brand/5 p-7">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">
              Pending legal review
            </p>
            <p className="mt-3 text-sm leading-relaxed text-chalk-body">
              This describes exactly what the website does with your data today. The formal
              wording, registered company details, the legal basis relied on, retention
              periods and the supervisory authority to complain to, is being confirmed with
              Dean&apos;s List LTD before launch.
            </p>
          </div>

          <div className="mt-14 space-y-12">
            {SECTIONS.map((s) => (
              <section key={s.heading}>
                <h2 className="text-2xl uppercase tracking-wide text-brand">{s.heading}</h2>
                <div className="mt-4 space-y-4 leading-relaxed text-chalk-muted">
                  {s.body.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </section>
            ))}

            <section>
              <h2 className="text-2xl uppercase tracking-wide text-brand">Contact</h2>
              <p className="mt-4 leading-relaxed text-chalk-muted">
                For anything on this page, email{" "}
                <a href={`mailto:${SITE.email}`} className="text-brand hover:underline">
                  {SITE.email}
                </a>
                . {SITE.legalName}, {SITE.location}.
              </p>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
