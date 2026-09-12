import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { SITE } from "@/content/site";
import { getGoogleAnalyticsId, getMetaPixelId } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What data the Dean's List website collects, why, and how to have it removed.",
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
    heading: "Visitor statistics",
    body: [
      "We count visits to this site ourselves, to see which pages people read and how they find us. This uses no cookies and stores nothing on your device, so it runs for everyone without asking.",
      "For each page viewed we keep: the page address, never including anything after a question mark; the website that sent you, if there was one; any campaign tags in the link you followed; your country; whether you used a phone, tablet or computer; and the name of your browser and operating system, without version numbers.",
      "We do not keep your IP address. It is used for a moment to look up your country, in a database held on our own server, and together with your browser details and a random value that changes every day, to make a code that lets us count one visitor once per day. The random value is deleted when the day ends, after which that code cannot be connected to you or to your other visits, even by us.",
      "Visits by automated software, and by our team while signed in to the dashboard, are not counted. These statistics are seen only by the Dean's List team, are kept for two years, and are never shared or sold.",
    ],
  },
  {
    heading: "Cookies",
    // Replaced on every render by cookieParagraphs(), which reads what is
    // switched on in the dashboard. Kept here so the heading stays in order.
    body: [],
  },
];

/**
 * The Cookies section, written for the site as it is configured right now.
 *
 * Google Analytics and the Meta Pixel are each switched on by an id in the
 * dashboard, so what this section has to say changes without a deploy. It is
 * assembled from what is actually on, which keeps it true in every combination
 * rather than true for the combination someone remembered to update.
 */
function cookieParagraphs(gaOn: boolean, pixelOn: boolean): string[] {
  const paragraphs = [
    "This site sets one cookie of its own, and only for signed-in administrators: a session cookie that keeps them logged in to the dashboard.",
  ];

  if (!gaOn && !pixelOn) {
    paragraphs.push(
      "The public site sets no advertising or analytics cookies. If either is switched on, its cookies will wait for your consent and this page will say so.",
    );
    return paragraphs;
  }

  if (gaOn) {
    paragraphs.push(
      "We use Google Analytics to see which pages people read and how they find the site. Its code is on every page, but until you choose Allow on the banner it runs in a restricted mode: it sets no cookies, cannot recognise you from one visit to the next, and sends Google only an anonymous record of the page viewed and basic details of your browser and device.",
      "If you choose Allow, Google Analytics may set cookies that let it recognise a returning visitor. It is not connected to any advertising, and it is never given your name, email or anything you type into a form.",
    );
  }

  if (pixelOn) {
    paragraphs.push(
      "For advertising we use the Meta Pixel, which tells us which ads bring performers here. It loads only if you choose Allow on the banner. Choose No thanks and nothing is loaded: no pixel, no request to Facebook, no advertising cookie.",
      "The pixel reports page views. It is never given your name, email or anything you type into a form, and we do not sell or share your details with advertisers.",
    );
  }

  paragraphs.push("Your choice is remembered in your own browser. Clearing your browsing data asks you again.");
  return paragraphs;
}

export default async function PrivacyPage() {
  const [gaId, pixelId] = await Promise.all([getGoogleAnalyticsId(), getMetaPixelId()]);
  const cookies = cookieParagraphs(Boolean(gaId), Boolean(pixelId));
  const sections = SECTIONS.map((s) => (s.heading === "Cookies" ? { ...s, body: cookies } : s));

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy policy"
        lede="What this site collects, why, and how to get it removed."
      />

      <section className="section">
        <div className="shell">
          <div className="max-w-[68ch]">
            <div className="border-l-4 border-brand bg-brand-tint p-6">
              <p className="kicker">Pending legal review</p>
              <p className="mt-3 text-body text-neutral-800">
                This describes exactly what the website does with your data
                today. The formal wording, registered company details, the legal
                basis relied on, retention periods and the supervisory authority
                to complain to, is being confirmed with Dean&apos;s List LTD
                before launch.
              </p>
            </div>

            <div className="divider mt-14 space-y-12 pt-12">
              {sections.map((s) => (
                <section key={s.heading}>
                  <h2 className="text-display-sm font-extrabold">
                    {s.heading}
                  </h2>
                  <div className="mt-4 space-y-4 text-pretty text-body text-neutral-700">
                    {s.body.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </section>
              ))}

              <section>
                <h2 className="text-display-sm font-extrabold">Contact</h2>
                <p className="mt-4 text-pretty text-body text-neutral-700">
                  For anything on this page, email{" "}
                  <a
                    href={`mailto:${SITE.email}`}
                    className="text-brand-onLight underline underline-offset-4"
                  >
                    {SITE.email}
                  </a>
                  . {SITE.legalName}, {SITE.location}.
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
