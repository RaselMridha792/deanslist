import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Picture } from "@/components/media/Picture";
import { VideoEmbed } from "@/components/media/VideoEmbed";
import { getWinner, extractYouTubeId } from "@/lib/queries";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const winner = await getWinner(slug);
  if (!winner) return { title: "Winner not found" };

  const title = winner.showTitle ? `${winner.name} — ${winner.showTitle} winner` : winner.name;

  return {
    title: winner.name,
    description: winner.story?.slice(0, 160) ?? title,
    alternates: { canonical: `/winners/${winner.slug}` },
    openGraph: {
      title,
      description: winner.story?.slice(0, 200) ?? undefined,
      url: `${env.NEXT_PUBLIC_SITE_URL}/winners/${winner.slug}`,
      type: "profile",
    },
  };
}

export default async function WinnerPage({ params }: Params) {
  const { slug } = await params;
  const winner = await getWinner(slug);
  if (!winner) notFound();

  const videoId = extractYouTubeId(winner.videoUrl);

  return (
    <>
      <section className="border-b border-ink-line">
        <div className="shell grid gap-12 pb-16 pt-32 md:pt-40 lg:grid-cols-[0.9fr_1fr] lg:gap-20">
          <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-ink-line">
            {winner.photoUrl ? (
              <Picture
                src={winner.photoUrl}
                alt={winner.name}
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
            ) : (
              <div className="grid h-full place-items-center bg-ink-soft">
                <span className="font-display text-8xl text-chalk-ghost">
                  {winner.name.charAt(0)}
                </span>
              </div>
            )}
            <span className="absolute inset-x-0 bottom-0 h-px bg-gold-hairline" />
          </div>

          <div className="flex flex-col justify-center">
            {winner.showTitle && <p className="eyebrow">{winner.showTitle} — winner</p>}
            <h1 className="mt-4 text-display-lg uppercase">{winner.name}</h1>

            {winner.prizeAwarded !== null && (
              <p className="mt-6 font-display text-7xl leading-none text-metal">
                ${winner.prizeAwarded.toLocaleString("en-US")}
              </p>
            )}

            {winner.story && (
              <p className="mt-7 max-w-prose text-body-lg leading-relaxed text-chalk-body">
                {winner.story}
              </p>
            )}

            <div className="mt-10 flex flex-wrap gap-4">
              <ButtonLink href="/enter">Enter the next one</ButtonLink>
              <ButtonLink href="/winners" variant="ghost">
                All winners
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {videoId && (
        <section className="section border-b border-ink-line">
          <div className="shell max-w-4xl">
            <p className="eyebrow">The performance</p>
            <div className="mt-6">
              <VideoEmbed videoId={videoId} title={`${winner.name} — winning performance`} />
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="shell text-center">
          <h2 className="text-display-md uppercase">Your name could be next</h2>
          <p className="mx-auto mt-4 max-w-prose text-chalk-muted">
            Every winner started with a single entry and a link to a performance.
          </p>
          <div className="mt-9">
            <ButtonLink href="/enter" size="lg">
              Enter the contest
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
