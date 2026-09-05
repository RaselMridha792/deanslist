import { ButtonAnchor } from "@/components/dl/Button";
import { Kicker } from "@/components/dl/Kicker";
import { PlaySquare } from "@/components/dl/PlayIcon";
import { Reveal } from "@/components/dl/Reveal";
import { SITE } from "@/content/site";
import type { Episode } from "@/lib/queries";

/**
 * Six thumbnails, no iframes. A real YouTube embed costs roughly half a
 * megabyte of script and sets a tracking context before anyone has pressed
 * play; six of them on one screen is three megabytes on first paint. Each cell
 * is a plain link out to the video.
 *
 * The thumbnail is an <img> rather than GrayscaleImage because it is an
 * external URL: GrayscaleImage derives .avif and .webp siblings from the path,
 * which only holds inside the media tree. It carries the same grayscale filter.
 */
export function WatchGrid({
  episodes,
  showTitles,
}: {
  episodes: Episode[];
  showTitles: Record<string, string>;
}) {
  if (episodes.length === 0) return null;
  const shown = episodes.slice(0, 6);

  return (
    <section id="watch" className="mx-auto max-w-shell px-gutter pt-section-lg">
      <div className="flex flex-wrap items-end justify-between gap-8 border-b-2 border-rule pb-[clamp(24px,3vw,40px)]">
        <Reveal>
          <Kicker className="mb-5">03 / Watch</Kicker>
          <h2 className="m-0 text-display-md font-extrabold">From the stage.</h2>
        </Reveal>
        <Reveal index={1}>
          <ButtonAnchor href={SITE.socials.youtube} variant="outline" className="px-5 py-[14px]">
            All episodes on YouTube
          </ButtonAnchor>
        </Reveal>
      </div>

      <div className="grid gap-[2px] border-b-2 border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((episode, i) => {
          const show = episode.showSlug ? showTitles[episode.showSlug] : undefined;
          return (
            <Reveal key={episode.videoId} index={i}>
              <a
                href={`https://www.youtube.com/watch?v=${episode.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-[16/10] overflow-hidden bg-ink text-ground"
              >
                <img
                  src={`https://i.ytimg.com/vi/${episode.videoId}/hqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  className="grayscale-media absolute inset-0 h-full w-full object-cover opacity-80 transition-[transform,opacity] duration-[1200ms] ease-dl group-hover:scale-[1.05] group-hover:opacity-100"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-b from-transparent from-50% to-ink/80"
                />
                <PlaySquare className="absolute left-5 top-5" />
                <span className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
                  <span className="text-[clamp(16px,1.3vw,20px)] font-extrabold leading-[1.15] tracking-[-.02em]">
                    {episode.title}
                  </span>
                  {show && (
                    <span className="whitespace-nowrap text-eyebrow uppercase tracking-[.12em] opacity-70">
                      {show}
                    </span>
                  )}
                </span>
              </a>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
