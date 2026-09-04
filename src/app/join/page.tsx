import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { LeadForm } from "@/components/forms/LeadForm";

export const metadata: Metadata = {
  title: "Join the Dean Team",
  description:
    "Apply to join the Dean's List crew — judges, hosts, producers, editors and collaborators.",
};

const ROLES = [
  "Judge",
  "Host / presenter",
  "Producer",
  "Camera / editor",
  "Social media",
  "Music / sound",
  "Something else",
] as const;

const WHAT_WE_LOOK_FOR = [
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
        title="Work on the show"
        lede="The Dean's List runs on the people behind the camera as much as the ones in front of it. Tell us what you do."
        image="/media/gallery/cts-04"
      />

      <section className="section border-b border-ink-line">
        <div className="shell">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHAT_WE_LOOK_FOR.map((r) => (
              <div key={r.title} className="card p-7">
                <h2 className="text-xl uppercase tracking-wide text-gold">{r.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-chalk-muted">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell max-w-3xl">
          <p className="eyebrow">Application</p>
          <h2 className="mt-3 text-display-md uppercase">Tell us about you</h2>
          <p className="mt-4 text-chalk-muted">
            Applications are routed separately from contestant entries and reviewed by the
            production team.
          </p>

          <div className="mt-10 rounded-card border border-ink-line bg-ink-soft p-7 sm:p-9">
            <LeadForm
              type="CREW"
              fields={["firstName", "lastName", "email", "phone", "country", "role", "message"]}
              roleOptions={ROLES}
              submitLabel="Send application"
              messageLabel="Experience and links"
              messagePlaceholder="What have you worked on? Share a portfolio, reel, or channel link."
              consentLabel="Email me about production opportunities and show updates."
            />
          </div>
        </div>
      </section>
    </>
  );
}
