import type { Metadata } from "next";
import { Cell, CellGrid } from "@/components/dl/CellGrid";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { SectionHeading } from "@/components/dl/SectionHeading";
import { LeadForm } from "@/components/forms/LeadForm";
import { formatStat, getStats } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Sponsors and partners",
  description:
    "A weekly live audience of performers and fans across YouTube and Facebook, and a prize pool your brand can own.",
};

export const dynamic = "force-dynamic";

/**
 * Where a sponsor's brand shows up. Design-only copy: there is no dashboard
 * model behind it, and it describes the product rather than stating a figure.
 */
const EXPOSURE = [
  {
    label: "On air",
    title: "Title and host mentions",
    body: "Named in the show open, at each Freeze moment, and at the payout.",
  },
  {
    label: "On screen",
    title: "Prize pool and lower thirds",
    body: "Your mark on the live prize counter and broadcast graphics.",
  },
  {
    label: "In feed",
    title: "Clips and announcements",
    body: "Featured in highlight clips, show announcements and the mailing list.",
  },
  {
    label: "On site",
    title: "Sponsor band",
    body: "Logo placement across deanslist.live and every entry confirmation.",
  },
] as const;

/**
 * Three tiers, described and never priced.
 *
 * Package pricing is unconfirmed (session.md, "Still unconfirmed"), so these
 * carry no figures at all — not a range, not a "from". A prospective sponsor
 * gets the shape of the deal and a way to ask for the deck.
 *
 * The top tier is the one red field on this page. Everywhere else red stays a
 * chip, a rule, a button or a word.
 */
const PACKAGES = [
  {
    n: "01",
    name: "Title partner",
    body: "One brand owns the season. Show naming, prize pool branding, every broadcast and email.",
    tone: "bg-brand text-ground",
  },
  {
    n: "02",
    name: "Presenting partner",
    body: "On-air mentions and on-screen placement across a run of episodes.",
    tone: "bg-ink text-ground",
  },
  {
    n: "03",
    name: "Supporting partner",
    body: "Site and social placement, plus clips and announcement inclusion.",
    tone: "bg-ground text-ink",
  },
] as const;

/**
 * The package the inquiry is about.
 *
 * "Not sure yet" leads because LeadForm renders no empty placeholder option for
 * this select: whatever sits first is what an untouched dropdown submits, and a
 * sponsor who never opened it must not be recorded as asking for the title
 * package. The four labels are the design's own.
 */
const PACKAGE_INTEREST = [
  { value: "unsure", label: "Not sure yet" },
  { value: "title", label: "Title partner" },
  { value: "presenting", label: "Presenting partner" },
  { value: "supporting", label: "Supporting partner" },
] as const;

export default async function SponsorsPage() {
  /**
   * Reach is an advertising claim the moment it is shown to a buyer, so the
   * numbers come from getStats(), which returns verified rows only. The design
   * shows "700K+" in the first cell; the client's own figure is unconfirmed and
   * contradicted by their old site's counter, so it stays out until someone
   * checks it against the channel and flips SiteStat.verified. Nothing here
   * hardcodes a subscriber count.
   *
   * The two cells after it are qualities, not measurements, so they are safe to
   * state and are taken from the design verbatim.
   */
  const stats = await getStats();
  const reach = [
    ...stats.map((s) => ({ key: s.key, label: s.label, value: formatStat(s) })),
    { key: "cadence", label: "Live broadcasts, every Tuesday", value: "Weekly" },
    { key: "reach", label: "Entries and votes from around the world", value: "Global" },
  ];

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-ink text-ground">
        <div className="absolute inset-0 opacity-[.35]">
          <GrayscaleImage
            src="/media/gallery/cts-08"
            alt=""
            priority
            hover={false}
            sizes="100vw"
            className="h-full w-full"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink from-20% to-ink/40" />

        <div className="shell relative grid items-end gap-8 pb-[clamp(40px,5vw,72px)] pt-section lg:grid-cols-[7fr_5fr] lg:gap-16">
          <div className="animate-dl-rise">
            <Kicker onDark>Sponsors and partners</Kicker>
            <h1 className="mt-5 text-hero font-extrabold uppercase text-balance">
              Put your brand in front of the vote.
            </h1>
          </div>
          {/* Delay is inline, not a utility: `animate-dl-rise` is the animation
              shorthand, so a class-based delay is a coin toss on source order. */}
          <p
            className="animate-dl-rise max-w-[44ch] text-lede text-ground/85 text-pretty"
            style={{ animationDelay: "200ms" }}
          >
            A weekly live audience of performers and fans across YouTube and Facebook, and a prize
            pool your brand can own.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ reach */}
      <section className="shell pt-section">
        <CellGrid cols={3} className="border-y-2 border-rule">
          {reach.map((r, i) => (
            <Cell key={r.key} index={i} className="hover:bg-ground">
              <Kicker className="mb-[18px]">{r.label}</Kicker>
              <p className="text-stat font-extrabold">{r.value}</p>
            </Cell>
          ))}
        </CellGrid>
      </section>

      {/* --------------------------------------------------------- exposure */}
      <section className="shell pt-section">
        <SectionHeading
          kicker="01 / Exposure"
          title="Where your brand appears."
          aside={
            <p className="max-w-[52ch] text-lede text-neutral-800 text-pretty">
              Sponsors are woven into the show, not stuck on the side. Title mentions on air,
              prize-pool branding, placement in the broadcast, and reach across every announcement
              email the team sends.
            </p>
          }
        />
        <CellGrid cols={4} className="border-b-2 border-rule">
          {EXPOSURE.map((e, i) => (
            <Cell key={e.label} index={i} className="flex min-h-[260px] flex-col gap-[18px]">
              <p className="text-[14px] font-extrabold leading-none tracking-[.1em] text-brand">
                {e.label}
              </p>
              <h3 className="text-display-sm font-extrabold">{e.title}</h3>
              <p className="mt-auto text-body text-neutral-700 text-pretty">{e.body}</p>
            </Cell>
          ))}
        </CellGrid>
      </section>

      {/* --------------------------------------------------------- packages */}
      <section className="shell pt-section">
        {/* No rule under this header: the tier row is a block of full-bleed
            panels, and a divider above it would cut the red one in half. */}
        <Reveal className="pb-[clamp(24px,3vw,40px)]">
          <Kicker>02 / Packages</Kicker>
          <h2 className="mt-5 text-display-md font-extrabold text-balance">Three ways in.</h2>
        </Reveal>

        <CellGrid cols={3}>
          {PACKAGES.map((p, i) => (
            <Reveal
              key={p.name}
              index={i}
              className={`flex min-h-[360px] flex-col justify-between gap-6 p-[clamp(28px,3vw,48px)] ${p.tone}`}
            >
              <p className="text-kicker font-semibold uppercase opacity-80">{p.n}</p>
              <p className="text-display-sm font-extrabold">{p.name}</p>
              <p className="text-body opacity-85 text-pretty">{p.body}</p>
              <a
                href="#inquiry"
                className="block min-h-[44px] border-t-2 border-current pt-[14px] text-eyebrow font-semibold uppercase"
              >
                Request the deck
              </a>
            </Reveal>
          ))}
        </CellGrid>
      </section>

      {/* ---------------------------------------------------------- inquiry */}
      <section className="shell py-section">
        <div id="inquiry" className="grid items-start gap-8 lg:grid-cols-[5fr_7fr] lg:gap-24">
          <Reveal>
            <Kicker>03 / Inquiry</Kicker>
            <h2 className="mt-5 text-[clamp(32px,3.6vw,64px)] font-extrabold leading-[.95] tracking-[-.04em] text-balance">
              Start the conversation.
            </h2>
            <p className="mt-5 max-w-[40ch] text-[16px] leading-relaxed text-neutral-700">
              Sponsorship inquiries go straight to the producer. Expect a reply with the audience
              deck within two working days.
            </p>
          </Reveal>

          {/*
            LeadForm still carries its pre-redesign submit button (`btn-primary`
            without `.btn`, so no padding, no uppercase, a centred label). It is
            a shared component owned elsewhere, so the design's full-width flush
            left button is restored from out here rather than by editing it. The
            form has exactly one <button>. When LeadForm is brought over to the
            new system these four classes become a harmless no-op.
          */}
          <Reveal
            index={1}
            className="border-t-[6px] border-brand pt-6 [&_button]:btn [&_button]:btn-primary [&_button]:btn-lg [&_button]:w-full"
          >
            <LeadForm
              type="SPONSOR"
              fields={["firstName", "email", "company", "inquiryType", "message"]}
              inquiryOptions={PACKAGE_INTEREST}
              submitLabel="Send inquiry"
              messageLabel="Goals"
              messagePlaceholder="Audience, timing, and what success looks like"
              consentLabel="Send me the sponsorship deck and season announcements."
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}
