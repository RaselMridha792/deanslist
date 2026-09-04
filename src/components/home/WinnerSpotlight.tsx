import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { WinnerPortrait } from "@/components/media/WinnerPortrait";
import type { Winner } from "@/lib/queries";
import { SHOWS } from "@/content/site";

export function WinnerSpotlight({ winner }: { winner: Winner | null }) {
  if (!winner) return null;

  return (
    <section className="section border-b border-ink-line">
      <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="relative order-2 lg:order-1">
          <SectionHeading
            eyebrow={winner.showTitle ? `${winner.showTitle} — winner` : "Latest winner"}
            title={winner.name}
          />

          {winner.prizeAwarded !== null && (
            <p className="mt-6 font-display text-6xl leading-none text-metal">
              ${winner.prizeAwarded.toLocaleString("en-US")}
            </p>
          )}

          {winner.story && (
            <p className="mt-6 max-w-prose text-body-lg leading-relaxed text-chalk-muted">
              {winner.story}
            </p>
          )}

          <div className="mt-9 flex flex-wrap gap-4">
            <ButtonLink href={`/winners/${winner.slug}`} variant="ghost">
              Read the story
            </ButtonLink>
            <ButtonLink href="/winners" variant="quiet">
              All past winners →
            </ButtonLink>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <WinnerPortrait
            name={winner.name}
            photoUrl={winner.photoUrl}
            fallbackImage={SHOWS.find((s) => s.slug === winner.showSlug)?.keyArt}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="aspect-[4/5]"
          />
        </div>
      </div>
    </section>
  );
}
