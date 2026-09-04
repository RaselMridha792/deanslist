import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LeadForm } from "@/components/forms/LeadForm";
import { TALENT_CATEGORIES } from "@/content/site";

export const metadata: Metadata = {
  title: "Join the Dean Team",
  description:
    "Join the Dean's List talent pool, or apply to work on the show as a judge, host or crew.",
};

/**
 * The old /index.php/join-the-dean-team page is NOT a crew application, despite
 * how the proposal describes it. It embeds MachForm 88574, titled "Join Dean's
 * List Talent Pool", and the words crew, judge, host and producer appear zero
 * times on it. It is a roster signup: name, contact, full postal address, talent
 * category, a professional headshot, and "tell us about your talents".
 *
 * The signed scope asks for a crew and judges funnel, and that is worth having.
 * So this page serves both, with the talent pool first — that is what the URL's
 * existing traffic and search ranking are actually looking for, and burying it
 * would lose conversions the client already has.
 *
 * Anyone arriving to ENTER a contest is redirected to /enter; see next.config.ts.
 */

const CREW_ROLES = [
  "Judge",
  "Host / presenter",
  "Producer",
  "Camera / editor",
  "Social media",
  "Music / sound",
  "Something else",
] as const;

const CREW_AREAS = [
  {
    title: "Judges",
    body: "People with a real ear and the confidence to explain a decision on camera to a live audience.",
  },
  {
    title: "Hosts",
    body: "Presenters who can carry a live show, hold the energy, and keep a room moving.",
  },
  {
    title: "Production",
    body: "Editors, camera operators and sound people who can turn a live stream into something that looks broadcast.",
  },
  {
    title: "Social",
    body: "Anyone who understands how a clip travels and can cut for it.",
  },
];

export default function JoinPage() {
  return (
    <>
      <PageHero
        eyebrow="Join the Dean Team"
        title="Get on the roster"
        lede="Two ways in: join the talent pool so we can consider you for upcoming challenges, or apply to work on the show itself."
        image="/media/gallery/cts-04"
      >
        <div className="flex flex-wrap gap-4">
          <a href="#talent-pool" className="btn-primary">
            Join the talent pool
          </a>
          <a href="#crew" className="btn-ghost">
            Work on the show
          </a>
        </div>
      </PageHero>

      {/* ------------------------------------------------------ talent pool */}

      <section id="talent-pool" className="section border-b border-ink-line scroll-mt-24">
        <div className="shell grid gap-14 lg:grid-cols-[0.85fr_1fr] lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="Talent pool"
              title="Any talent. Big cash."
              lede="Singers, writers, musicians, DJs, rappers, chefs, athletes — the roster is not music-only, and never has been. Join it and we will consider you for upcoming challenges."
            />

            <ul className="mt-9 flex flex-wrap gap-2">
              {TALENT_CATEGORIES.map((c) => (
                <li
                  key={c.value}
                  className="rounded-full border border-ink-edge px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-chalk-muted"
                >
                  {c.label}
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-card border border-ink-line bg-ink-raised p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-chalk">
                Want to enter the current contest instead?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-chalk-muted">
                The talent pool is a standing roster. To enter the show that is open
                right now, use the entry form.
              </p>
              <Link href="/enter" className="btn-quiet mt-4">
                Enter the contest →
              </Link>
            </div>
          </div>

          <div className="rounded-card border border-ink-line bg-ink-soft p-6 sm:p-9">
            <LeadForm
              type="FAN"
              fields={[
                "firstName",
                "lastName",
                "email",
                "phone",
                "country",
                "talentCategory",
                "message",
              ]}
              talentOptions={TALENT_CATEGORIES}
              submitLabel="Join the talent pool"
              messageLabel="Tell us about your talents"
              messagePlaceholder="What do you do, how long have you been doing it, and where can we see you?"
              consentLabel="Email me when a challenge opens that fits what I do."
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- crew */}

      <section id="crew" className="section scroll-mt-24">
        <div className="shell">
          <SectionHeading
            eyebrow="Work on the show"
            title="Behind the camera"
            lede="The Dean's List runs on the people behind the camera as much as the ones in front of it."
          />

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CREW_AREAS.map((r) => (
              <div key={r.title} className="card p-7">
                <h3 className="text-xl uppercase tracking-wide text-gold">{r.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-chalk-muted">{r.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 max-w-3xl rounded-card border border-ink-line bg-ink-soft p-6 sm:p-9">
            <p className="eyebrow">Crew application</p>
            <h3 className="mt-3 text-2xl uppercase tracking-wide">Tell us what you do</h3>
            <p className="mt-3 text-sm text-chalk-muted">
              Routed separately from contestant entries and reviewed by the production team.
            </p>

            <div className="mt-8">
              <LeadForm
                type="CREW"
                fields={["firstName", "lastName", "email", "phone", "country", "role", "message"]}
                roleOptions={CREW_ROLES}
                submitLabel="Send application"
                messageLabel="Experience and links"
                messagePlaceholder="What have you worked on? Share a portfolio, reel, or channel link."
                consentLabel="Email me about production opportunities and show updates."
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
