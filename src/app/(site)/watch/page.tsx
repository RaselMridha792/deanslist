import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { VideoEmbed } from "@/components/media/VideoEmbed";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { getEpisodes, getShows } from "@/lib/queries";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SITE, CHANNEL_CONTENT, WHY_SUBSCRIBE, WATCH_COPY, WATCH_OUTRO } from "@/content/site";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Watch",
  description:
    "Full episodes and highlights from Drop That Mike and Crown the Sound, organised by show.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ show?: string }> };

export default async function WatchPage({ searchParams }: Props) {
  const { show: filter } = await searchParams;
  const [episodes, shows] = await Promise.all([getEpisodes(), getShows()]);

  const visible = filter ? episodes.filter((e) => e.showSlug === filter) : episodes;

  return (
    <>
      <PageHero
        eyebrow="Watch"
        title="Every episode"
        lede="Performances, highlights and full shows from the Dean's List stage."
        image="/media/gallery/social-01"
      />

      <section className="border-b border-ink-line">
        <div className="shell max-w-prose space-y-5 py-14 text-body-lg leading-relaxed text-chalk-muted">
          {WATCH_COPY.map((para) => (
            <p key={para.slice(0, 40)}>{para}</p>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="shell">
          {/* Filtering through the URL, so a filtered view can be shared and
              linked to rather than living only in component state. */}
          <nav className="flex flex-wrap gap-3" aria-label="Filter by show">
            <FilterChip href="/watch" active={!filter} label="All" />
            {shows.map((s) => (
              <FilterChip
                key={s.slug}
                href={`/watch?show=${s.slug}`}
                active={filter === s.slug}
                label={s.title}
              />
            ))}
          </nav>

          {visible.length === 0 ? (
            <p className="mt-12 text-chalk-muted">
              No episodes here yet. Everything goes live on{" "}
              <a
                href={SITE.socials.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                YouTube
              </a>{" "}
              first.
            </p>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((e) => (
                <VideoEmbed key={e.videoId} videoId={e.videoId} title={e.title} />
              ))}
            </div>
          )}

          <div className="mt-16 flex flex-wrap gap-4">
            <a
              href={SITE.socials.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              Subscribe on YouTube
            </a>
            <a
              href={SITE.socials.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              Follow on Facebook
            </a>
          </div>
        </div>
      </section>

      {/* Both sections below are the old site's own copy. The rebuild replaces
          its structure, not its message — dropping them would quietly lose
          content the client wrote. */}
      <section className="section border-t border-ink-line">
        <div className="shell">
          <SectionHeading
            eyebrow="On the channel"
            title="What you'll find"
            lede={WHY_SUBSCRIBE}
          />

          <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-ink-line bg-ink-line sm:grid-cols-2 lg:grid-cols-4">
            {CHANNEL_CONTENT.map((c, i) => (
              <div key={c.title} className="bg-ink-soft p-8">
                <p className="font-display text-4xl leading-none text-chalk-ghost">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-5 text-xl uppercase tracking-wide text-brand">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-chalk-muted">{c.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 max-w-prose text-chalk-muted">{WATCH_OUTRO}</p>
        </div>
      </section>

      <section className="section border-t border-ink-line bg-ink-raised">
        <div className="shell max-w-2xl text-center">
          <p className="eyebrow">Do not rely on the algorithm</p>
          <h2 className="mt-3 text-display-md uppercase">Get told when we go live</h2>
          <p className="mt-4 text-chalk-muted">
            Social platforms decide who sees a post. Email does not.
          </p>
          <div className="mt-8 text-left">
            <NewsletterForm source="watch" />
          </div>
        </div>
      </section>
    </>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-widest transition-colors duration-base ease-crisp",
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-ink-edge text-chalk-muted hover:border-brand hover:text-brand",
      )}
    >
      {label}
    </Link>
  );
}
