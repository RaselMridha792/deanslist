import type { Metadata } from "next";

import { ButtonLink } from "@/components/dl/Button";
import { Cell, CellGrid } from "@/components/dl/CellGrid";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { SectionHeading } from "@/components/dl/SectionHeading";
import { LeadForm } from "@/components/forms/LeadForm";
import { TALENT_CATEGORIES } from "@/content/site";

export const metadata: Metadata = {
  title: "Join the Dean Team",
  description:
    "Judges, hosts, crew and collaborators, plus the Dean's List talent pool. Apply to help build the shows, or join the roster.",
};

/**
 * Two audiences on one route, deliberately.
 *
 * The design file ("Join the Team.dc.html") is a crew page: four roles and a
 * production application. The live /index.php/join-the-dean-team is not. It
 * embeds MachForm 88574, titled "Join Dean's List Talent Pool", and the words
 * crew, judge and host appear on it zero times. It is a roster signup: name,
 * contact, full postal address, talent category, "tell us about your talents".
 *
 * Dropping either one loses something real. The crew funnel is signed scope;
 * the talent pool is what this URL's existing traffic and search ranking are
 * actually looking for. So the page runs the design top to bottom and the
 * talent pool follows it as its own band, on surface grey, so the two offers
 * read as two offers rather than as one form repeated.
 *
 * Both post to /api/leads through LeadForm, with different LeadType values so
 * the dashboard can route them apart. The postal address block belongs to the
 * talent pool half: it is the client's own field list on their own form, and
 * the requirement that every lead carry name, email, address and phone
 * (session.md) is what the roster is for.
 *
 * Anyone arriving to ENTER a contest is redirected to /enter; see next.config.ts.
 */

/** Roles, numbers and body copy verbatim from the design file. */
const ROLES = [
  {
    n: "01",
    title: "Judges",
    body: "Industry ears with a point of view. You watch entries, score performances and appear on the panel.",
  },
  {
    n: "02",
    title: "Hosts",
    body: "On-camera presence for live Tuesday broadcasts. Comfortable with a live chat and a draining prize pool.",
  },
  {
    n: "03",
    title: "Crew",
    body: "Editors, stream operators, designers and producers who make the broadcast run on time.",
  },
  {
    n: "04",
    title: "Collaborators",
    body: "Creators, venues and partners who want to build a challenge with the Dean's List.",
  },
] as const;

/** The design's own select options, in the design's order. */
const CREW_ROLES = ["Judge", "Host", "Crew", "Collaborator"] as const;

export default function JoinPage() {
  return (
    <>
      {/* ------------------------------------------------------------ hero */}

      <section className="relative overflow-hidden bg-ink text-ground">
        <div className="absolute inset-0 opacity-[.35]">
          <GrayscaleImage
            src="/media/gallery/cts-06"
            alt=""
            priority
            hover={false}
            sizes="100vw"
            className="h-full w-full"
          />
        </div>
        {/* 90deg: solid ink to 20%, falling to 40% ink at the right edge. */}
        <div className="absolute inset-0 bg-gradient-to-r from-ink from-20% to-ink/40" />

        <div className="shell relative grid items-end gap-[clamp(32px,4vw,64px)] pb-[clamp(40px,5vw,72px)] pt-section min-[901px]:grid-cols-[7fr_5fr]">
          <div className="animate-dl-rise">
            <Kicker onDark>Join the Dean Team</Kicker>
            <h1 className="mt-5 text-balance text-hero font-extrabold uppercase">
              Behind every show, a team.
            </h1>
          </div>
          {/* The design staggers the hero children by .2s. Inline rather than a
              class: `animate-dl-rise` sets the animation shorthand, which resets
              animation-delay, and only an inline longhand is guaranteed to win. */}
          <p
            className="max-w-[44ch] animate-dl-rise text-pretty text-lede text-ground/85"
            style={{ animationDelay: "200ms" }}
          >
            Judges, hosts, crew and collaborators. If you want to help build the shows
            rather than compete in them, this is your route.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- roles */}

      {/*
        Four equal cells between two 2px rules. The vertical rules are the grid
        background showing through a 2px gap, so the outer edges stay clean and
        the last cell needs no override.
      */}
      <section className="shell pt-section">
        <div className="border-y-2 border-rule">
          <CellGrid cols={4}>
            {ROLES.map((role, i) => (
              <Cell key={role.title} index={i} className="flex min-h-[260px] flex-col gap-[18px]">
                <p className="text-[14px] font-extrabold leading-none tracking-[.1em] text-brand">
                  {role.n}
                </p>
                <h2 className="text-display-sm font-extrabold">{role.title}</h2>
                <p className="mt-auto text-pretty text-body text-neutral-700">{role.body}</p>
              </Cell>
            ))}
          </CellGrid>
        </div>
      </section>

      {/* ------------------------------------------------- crew application */}

      <section id="crew" className="shell pt-section">
        <div className="grid items-start gap-[clamp(32px,5vw,96px)] min-[901px]:grid-cols-[5fr_7fr]">
          <Reveal>
            <Kicker>Apply</Kicker>
            {/*
              The design sets this heading at clamp(32px,3.6vw,64px), between
              display-sm and display-md and the one size on the page the token
              scale does not carry. The clamp is the design's own value.
            */}
            <h2 className="mt-5 text-balance text-[clamp(32px,3.6vw,64px)] font-extrabold leading-[.95] tracking-[-.04em]">
              Tell us what you bring.
            </h2>
            <p className="mt-5 max-w-[40ch] text-body text-neutral-700">
              Applications are routed separately from contestant entries and reviewed by
              the production team.
            </p>
          </Reveal>

          {/*
            6px red top rule, the treatment every form in this system carries.

            Six fields, in the design's order and with the design's labels and
            placeholders: Full name, Email, Role, Location, Portfolio or social
            link, Why you. An application is a pitch, not an address book entry,
            so nothing here asks for a phone number or a postcode; that block
            belongs to the talent pool below, where the client's own form asks
            for it. The consent checkbox is the one addition, because the design
            is a static mock with no mailing list behind it.

            The design ends in place: no redirect, a grey panel with a 4px red
            left rule where the fields were.
          */}
          <Reveal index={1} className="border-t-[6px] border-brand pt-6">
            <LeadForm
              type="CREW"
              fields={["fullName", "email", "role", "location", "link", "message"]}
              roleOptions={CREW_ROLES}
              submitLabel="Send application"
              messageLabel="Why you"
              messageRequired
              messagePlaceholder="Experience, availability, and what you would bring to the show"
              consentLabel="Email me about production opportunities and show updates."
              successTitle="Thanks."
              successBody="Your application is with the production team. Expect a reply by email."
            />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------ talent pool */}

      <section id="talent-pool" className="mt-section bg-surface">
        <div className="shell py-section">
          <SectionHeading
            kicker="Talent pool"
            title="Any talent. Big cash."
            aside={
              <p className="max-w-[52ch] text-pretty text-lede text-neutral-700">
                Singers, writers, musicians, DJs, rappers, chefs, athletes. The roster is
                not music-only, and never has been. Join it and we will consider you for
                upcoming challenges.
              </p>
            }
          />

          <div className="mt-12 grid items-start gap-[clamp(32px,5vw,96px)] min-[901px]:grid-cols-[5fr_7fr]">
            <Reveal>
              {/*
                The categories are the client's own list from MachForm 88574, read
                from the content module so the same set drives the chips and the
                select below. Chef and fitness are on it: the competition is not
                music-only, and the chips are the fastest way to say so.
              */}
              <ul className="flex flex-wrap gap-2">
                {TALENT_CATEGORIES.map((c) => (
                  <li
                    key={c.value}
                    className="border-2 border-rule px-3 py-2 text-eyebrow font-semibold uppercase text-neutral-700"
                  >
                    {c.label}
                  </li>
                ))}
              </ul>

              <div className="mt-8 border-2 border-rule bg-ground p-6">
                <p className="text-eyebrow font-semibold uppercase text-neutral-700">
                  Want to enter the current contest instead?
                </p>
                <p className="mt-3 text-body text-neutral-700">
                  The talent pool is a standing roster. To enter the show that is open
                  right now, use the entry form.
                </p>
                <ButtonLink href="/enter" variant="outline" className="mt-5">
                  Enter the contest
                </ButtonLink>
              </div>
            </Reveal>

            {/*
              No successTitle here, so this half still lands on /thank-you. The
              talent pool has its own copy waiting there ("from=fan"), plus the
              next steps and follow links a standing roster signup wants, and it
              is a long scroll back up from the bottom of this page.
            */}
            <Reveal index={1} className="border-t-[6px] border-brand pt-6">
              <LeadForm
                type="FAN"
                fields={[
                  "firstName",
                  "lastName",
                  "email",
                  "phone",
                  "country",
                  "address",
                  "talentCategory",
                  "message",
                ]}
                talentOptions={TALENT_CATEGORIES}
                submitLabel="Join the talent pool"
                messageLabel="Tell us about your talents"
                messagePlaceholder="What do you do, how long have you been doing it, and where can we see you?"
                consentLabel="Email me when a challenge opens that fits what I do."
              />
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
