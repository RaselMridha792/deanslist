import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LeadForm } from "@/components/forms/LeadForm";
import { formatStat, getStats } from "@/lib/queries";
import { SPONSOR_TIERS } from "@/content/site";

export const metadata: Metadata = {
  title: "Sponsors & Partners",
  description:
    "Put your brand in front of a global talent competition audience across YouTube and Facebook.",
};

export const dynamic = "force-dynamic";

export default async function SponsorsPage() {
  const stats = await getStats();

  return (
    <>
      <PageHero
        eyebrow="Sponsors & partners"
        title="Back the stage"
        lede="A live talent competition with a global audience, an engaged comment section, and a format built around participation."
        image="/media/shows/crown-the-sound-7"
      />

      {/*
        Only verified figures render here. Reach numbers shown to a prospective
        sponsor are an advertising claim, and the old site's own counter is
        broken (".7Mil+", a bare "K"), so nothing unconfirmed is repeated.
        See docs/SITE-AUDIT.md section 5.
      */}
      {stats.length > 0 && (
        <section className="border-b border-ink-line bg-ink-raised">
          <div className="shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <div key={s.key}>
                <p className="font-display text-5xl leading-none text-metal">{formatStat(s)}</p>
                <p className="mt-2 text-eyebrow uppercase text-chalk-faint">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section border-b border-ink-line">
        <div className="shell">
          <SectionHeading
            eyebrow="Why it works"
            title="An audience that participates"
            lede="On Drop That Mike the audience votes Freeze or Pass and moves the prize pool in real time. Attention is not passive — people are in the comments because their vote changes the outcome."
          />
        </div>
      </section>

      <section className="section border-b border-ink-line bg-ink-raised">
        <div className="shell">
          <SectionHeading eyebrow="Packages" title="Ways to partner" />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {SPONSOR_TIERS.map((t, i) => (
              <div key={t.name} className="card relative overflow-hidden p-8">
                {i === 0 && <span className="absolute inset-x-0 top-0 h-px bg-brand-hairline" />}
                <p className="font-display text-5xl leading-none text-chalk-ghost">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-5 text-2xl uppercase tracking-wide text-brand">{t.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-chalk-muted">{t.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-chalk-faint">
            Package pricing is put together per season and per brand. Tell us what you are
            trying to reach and we will send options.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell max-w-3xl">
          <p className="eyebrow">Enquiry</p>
          <h2 className="mt-3 text-display-md uppercase">Start a conversation</h2>

          <div className="mt-10 rounded-card border border-ink-line bg-ink-soft p-7 sm:p-9">
            <LeadForm
              type="SPONSOR"
              fields={["firstName", "lastName", "email", "phone", "company", "country", "message"]}
              submitLabel="Send enquiry"
              messageLabel="What are you looking for?"
              messagePlaceholder="Budget range, timing, and what a good result looks like for you."
              consentLabel="Send me the sponsorship deck and season announcements."
            />
          </div>
        </div>
      </section>
    </>
  );
}
