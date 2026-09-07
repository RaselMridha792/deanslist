import type { Metadata } from "next";
import Link from "next/link";

import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { ButtonLink } from "@/components/dl/Button";
import { getPromotions } from "@/lib/promotions";

export const metadata: Metadata = {
  title: "Campaigns",
  description:
    "Contests and open calls running alongside the Dean's List shows. Watch parties, calls for talent, and the prizes attached to each.",
};

// Campaigns change week to week from the dashboard, so this reads per request.
export const dynamic = "force-dynamic";

/**
 * The campaign index.
 *
 * Posters are the client's own artwork and they are LOUD — gold, red, high
 * contrast, type baked into the image. So this page does almost nothing: it
 * frames them and gets out of the way. Any decoration of my own would be a
 * second design competing with the one the client paid for.
 *
 * The one thing the page does insist on is status. A finished contest stays
 * listed rather than being hidden, because a visitor deciding whether this is
 * real is helped more by "that one ended" than by a page that only ever shows
 * things in progress. It is labelled, so nobody enters a contest that closed.
 */
export default async function CampaignsPage() {
  const promotions = await getPromotions();
  const running = promotions.filter((p) => p.status === "RUNNING");

  return (
    <>
      <section className="bg-ink text-ground">
        <div className="shell pb-[clamp(40px,5vw,72px)] pt-[clamp(56px,7vw,120px)]">
          <Kicker onDark>Campaigns</Kicker>
          <h1 className="mt-5 max-w-[16ch] text-balance text-hero font-extrabold uppercase">
            Ways to get in on it.
          </h1>
          <p className="mt-5 max-w-[54ch] text-pretty text-lede text-ground/85">
            Contests and open calls that run alongside the shows. Some are for
            performers and some are for the crowd watching at home.
            {running.length > 0 && ` ${running.length} running right now.`}
          </p>
        </div>
      </section>

      <section className="shell pb-section-lg pt-section">
        {promotions.length === 0 ? (
          <div className="border-2 border-rule p-[clamp(32px,5vw,64px)] text-center">
            <p className="text-lede text-neutral-700">
              Nothing running at the moment. The next contest is announced on
              the channels and to the email list first.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/shows" variant="outline">
                See the shows
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="grid gap-[2px] bg-rule min-[901px]:grid-cols-2">
            {promotions.map((p, i) => (
              <Reveal key={p.slug} index={i} className="bg-ground">
                <Link
                  href={`/campaigns/${p.slug}`}
                  className="group flex h-full flex-col focus-visible:outline-offset-[-2px]"
                >
                  {p.imagePath && (
                    <div className="relative overflow-hidden">
                      <GrayscaleImage
                        src={p.imagePath}
                        alt=""
                        ratio="4/3"
                        sizes="(min-width: 901px) 50vw, 100vw"
                        // The client's own artwork: in colour, and whole. One
                        // poster is portrait and the next is landscape, so a
                        // shared crop would cut the title off the tall one.
                        color
                        contain
                        hover={false}
                        className="h-full w-full"
                      />
                      {/* Status sits on the poster because the poster is the
                          thing being scanned, and a closed contest that reads as
                          open wastes somebody's evening. */}
                      <span
                        className={
                          p.status === "RUNNING"
                            ? "absolute left-5 top-5 bg-brand px-3 py-1.5 text-kicker font-semibold uppercase text-white"
                            : "absolute left-5 top-5 bg-ink px-3 py-1.5 text-kicker font-semibold uppercase text-ground/80"
                        }
                      >
                        {p.status === "RUNNING" ? "Running now" : "Ended"}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-1 flex-col gap-4 p-[clamp(24px,3vw,40px)]">
                    {p.kicker && <Kicker>{p.kicker}</Kicker>}
                    <h2 className="text-balance text-[clamp(26px,2.6vw,42px)] font-extrabold leading-[.98] tracking-[-.03em] transition-colors duration-200 ease-dl group-hover:text-brand-onLight">
                      {p.title}
                    </h2>
                    <p className="text-pretty text-body text-neutral-700">
                      {p.summary}
                    </p>

                    {p.prizeTitle && (
                      <p className="mt-auto border-t-2 border-rule pt-4">
                        <span className="block text-eyebrow font-semibold uppercase text-neutral-600">
                          Prize
                        </span>
                        <span className="mt-1 block text-[clamp(16px,1.3vw,20px)] font-extrabold tracking-[-.02em]">
                          {p.prizeTitle}
                        </span>
                      </p>
                    )}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
