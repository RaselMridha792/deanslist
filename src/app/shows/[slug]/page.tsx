import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Countdown } from "@/components/ui/Countdown";
import { VideoEmbed } from "@/components/media/VideoEmbed";
import { getShow, getEpisodes } from "@/lib/queries";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const show = await getShow(slug);
  if (!show) return { title: "Show not found" };

  return {
    title: show.title,
    description: show.tagline ?? show.description ?? undefined,
    alternates: { canonical: `/shows/${show.slug}` },
    openGraph: {
      title: show.title,
      description: show.tagline ?? undefined,
      url: `${env.NEXT_PUBLIC_SITE_URL}/shows/${show.slug}`,
    },
  };
}

export default async function ShowPage({ params }: Params) {
  const { slug } = await params;
  const show = await getShow(slug);
  if (!show) notFound();

  const episodes = await getEpisodes(slug);
  const takingEntries = show.status === "OPEN" || show.status === "LIVE";

  return (
    <>
      <PageHero
        eyebrow={show.cadence ?? undefined}
        title={show.title}
        lede={show.tagline ?? undefined}
        image={show.keyArt}
      >
        <div className="flex flex-wrap items-center gap-4">
          {show.status === "LIVE" && <Badge live>Live now</Badge>}
          {takingEntries ? (
            <ButtonLink href={`/enter?show=${show.slug}`} size="lg">
              Enter this show
            </ButtonLink>
          ) : (
            <Badge>Season closed</Badge>
          )}
          {show.prizeAmount !== null && (
            <span className="font-display text-3xl leading-none text-metal">
              ${show.prizeAmount.toLocaleString("en-US")}
            </span>
          )}
        </div>

        {show.entryDeadline && (
          <div className="mt-10">
            <Countdown target={show.entryDeadline} label="Entries close in" />
          </div>
        )}
      </PageHero>

      {show.description && (
        <section className="section border-b border-ink-line">
          <div className="shell">
            <SectionHeading eyebrow="The format" title="How this one works" />
            <p className="mt-6 max-w-prose text-body-lg leading-relaxed text-chalk-muted">
              {show.description}
            </p>
          </div>
        </section>
      )}

      {/* Freeze and Pass is the mechanic the whole show is built on, so it gets
          its own treatment rather than a bullet in the description. */}
      {show.mechanic && show.mechanic.length > 0 && (
        <section className="section border-b border-ink-line bg-ink-raised">
          <div className="shell">
            <SectionHeading
              eyebrow="The mechanic"
              title="You control the pot"
              lede="The prize pool drains in real time. What the audience does next decides where it stops."
            />

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {show.mechanic.map((m, i) => (
                <div key={m.name} className="card relative overflow-hidden p-9">
                  <span className="absolute inset-x-0 top-0 h-px bg-gold-hairline" />
                  <p className="font-display text-6xl leading-none text-chalk-ghost">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-5 text-display-sm uppercase text-gold">{m.name}</h3>
                  <p className="mt-3 leading-relaxed text-chalk-muted">{m.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {episodes.length > 0 && (
        <section className="section border-b border-ink-line">
          <div className="shell">
            <SectionHeading eyebrow="Watch" title={`${show.title} on screen`} />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {episodes.map((e) => (
                <VideoEmbed key={e.videoId} videoId={e.videoId} title={e.title} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Facts the client has not confirmed are shown as an honest gap rather
          than filled with a guess. See docs/PROJECT-BRIEF.md section 8. */}
      {show.pending && show.pending.length > 0 && (
        <section className="border-b border-ink-line">
          <div className="shell py-10">
            <p className="text-sm text-chalk-faint">
              Still to be announced: {show.pending.join(", ").toLowerCase()}. Join the list
              below and you will hear first.
            </p>
          </div>
        </section>
      )}

      <section className="section">
        <div className="shell text-center">
          <h2 className="text-display-md uppercase">
            {takingEntries ? "Entries are open" : "Be first for next season"}
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <ButtonLink href={takingEntries ? `/enter?show=${show.slug}` : "/enter"} size="lg">
              {takingEntries ? "Enter now" : "Register interest"}
            </ButtonLink>
            <ButtonLink href="/shows" variant="ghost" size="lg">
              All shows
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
