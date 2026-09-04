import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { Picture } from "@/components/media/Picture";
import type { Winner } from "@/lib/queries";

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
          <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-ink-line">
            {winner.photoUrl ? (
              <Picture
                src={winner.photoUrl}
                alt={`${winner.name}, winner`}
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
            ) : (
              <div className="grid h-full place-items-center bg-ink-soft">
                <span className="font-display text-7xl text-chalk-ghost">
                  {winner.name.charAt(0)}
                </span>
              </div>
            )}
            {/* Gold hairline along the base, the one decorative use of the accent
                on this section. */}
            <span className="absolute inset-x-0 bottom-0 h-px bg-gold-hairline" />
          </div>
        </div>
      </div>
    </section>
  );
}
