import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { Picture } from "@/components/media/Picture";
import { SHOWS } from "@/content/site";
import { getWinners } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Past Winners",
  description:
    "Everyone who has taken the cash prize and a place on the Principal's Roll of the Dean's List.",
};

export const dynamic = "force-dynamic";

export default async function WinnersPage() {
  const winners = await getWinners();

  return (
    <>
      <PageHero
        eyebrow="Principal's Roll"
        title="Past winners"
        lede="Every season ends with one name. These are the performances that took the prize."
        image="/media/gallery/cts-05"
      />

      <section className="section">
        <div className="shell">
          {winners.length === 0 ? (
            <p className="text-chalk-muted">
              The first winner will be announced at the end of the current season.
            </p>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {winners.map((w) => (
                <Link
                  key={w.slug}
                  href={`/winners/${w.slug}`}
                  className="card-interactive group block overflow-hidden"
                >
                  <div className="relative aspect-[4/5]">
                    {w.photoUrl ? (
                      <Picture
                        src={w.photoUrl}
                        alt={w.name}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        imgClassName="transition-transform duration-slow ease-cine group-hover:scale-[1.03]"
                      />
                    ) : (
                      <>
                        {(() => {
                          const art = SHOWS.find((s) => s.slug === w.showSlug)?.keyArt;
                          return art ? (
                            <div className="absolute inset-0 opacity-25">
                              <Picture src={art} alt="" sizes="33vw" />
                            </div>
                          ) : null;
                        })()}
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid h-20 w-20 place-items-center rounded-full border border-gold/30">
                            <span className="font-display text-4xl leading-none text-metal">
                              {w.name.charAt(0).toUpperCase()}
                            </span>
                          </span>
                        </span>
                      </>
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />

                    {w.prizeAwarded !== null && (
                      <span className="absolute left-5 top-5 rounded-full bg-gold-metal px-3 py-1 text-eyebrow font-bold uppercase text-ink">
                        ${w.prizeAwarded.toLocaleString("en-US")}
                      </span>
                    )}
                  </div>

                  <div className="p-6">
                    {w.showTitle && <p className="eyebrow">{w.showTitle}</p>}
                    <h2 className="mt-2 text-2xl uppercase tracking-wide">{w.name}</h2>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
