import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { VideoEmbed } from "@/components/media/VideoEmbed";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { getEpisodes, getShows } from "@/lib/queries";
import { SITE } from "@/content/site";
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
                className="text-gold hover:underline"
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
          ? "border-gold bg-gold/10 text-gold"
          : "border-ink-edge text-chalk-muted hover:border-gold hover:text-gold",
      )}
    >
      {label}
    </Link>
  );
}
