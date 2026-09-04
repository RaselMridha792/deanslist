import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { Picture } from "@/components/media/Picture";
import { HOW_IT_WORKS, SITE } from "@/content/site";

export const metadata: Metadata = {
  title: "What is the Dean's List",
  description:
    "A platform built to celebrate excellence and showcase worldwide talent. Perform, get voted on, win the prize, and take a place on the Principal's Roll.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="What is it"
        title="More than a name"
        lede="The Dean's List is a platform created to celebrate excellence and showcase worldwide talent. Every performance becomes part of the experience, showing the range of style, skill and originality that exists in music today."
        image="/media/shows/crown-the-sound-4"
      />

      <section className="section border-b border-ink-line">
        <div className="shell grid gap-14 lg:grid-cols-[1fr_0.85fr] lg:gap-20">
          <div>
            <SectionHeading eyebrow="The stage" title="A competition without a venue" />
            <div className="mt-6 space-y-5 text-body-lg leading-relaxed text-chalk-muted">
              <p>
                Contestants perform in front of a live audience across YouTube and Facebook,
                competing across seasons while judges weigh creativity, stage presence and
                originality.
              </p>
              <p>
                There is no room to fly to, no gatekeeper to get past, and no equipment
                requirement beyond what it takes to record a performance. That is the whole
                idea — talent anywhere in the world reaches the same stage.
              </p>
            </div>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-ink-line">
            <Picture
              src="/media/gallery/cts-03"
              alt="A contestant performing on the Dean's List stage"
              sizes="(min-width: 1024px) 40vw, 100vw"
            />
          </div>
        </div>
      </section>

      {/* The Principal's Roll is the brand's own idea and its strongest one, so
          it gets a section rather than a sentence. */}
      <section className="section border-b border-ink-line bg-ink-raised">
        <div className="shell">
          <SectionHeading
            eyebrow="The prize"
            title="The Principal's Roll"
            lede="The winner earns more than applause. They take a cash prize and, more lastingly, a place on the Principal's Roll of the Dean's List."
            align="center"
          />

          <div className="mx-auto mt-14 max-w-3xl">
            <div className="relative overflow-hidden rounded-card border border-gold/25 bg-ink-soft p-10 text-center">
              <span className="absolute inset-x-0 top-0 h-px bg-gold-hairline" />
              <p className="font-display text-7xl leading-none text-metal">$1,000</p>
              <p className="mt-3 text-eyebrow uppercase text-chalk-faint">
                Awarded to the Crown the Sound winner
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section border-b border-ink-line">
        <div className="shell">
          <SectionHeading eyebrow="How it works" title="From entry to the roll" />

          <ol className="mt-12 grid gap-px overflow-hidden rounded-card border border-ink-line bg-ink-line sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((s) => (
              <li key={s.step} className="bg-ink-soft p-8">
                <p className="font-display text-5xl leading-none text-metal">{s.step}</p>
                <h3 className="mt-5 text-xl uppercase tracking-wide">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-chalk-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="shell text-center">
          <h2 className="text-display-md uppercase">Ready to perform?</h2>
          <p className="mx-auto mt-4 max-w-prose text-chalk-muted">
            Entry takes a few minutes. All you need is a link to a performance.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <ButtonLink href="/enter" size="lg">
              Enter the contest
            </ButtonLink>
            <ButtonLink href="/shows" variant="ghost" size="lg">
              See the shows
            </ButtonLink>
          </div>
          <p className="mt-8 text-sm text-chalk-faint">
            Questions? Email{" "}
            <a href={`mailto:${SITE.email}`} className="text-gold hover:underline">
              {SITE.email}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
