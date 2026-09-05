import { ButtonAnchor } from "@/components/dl/Button";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { VideoPlayer } from "@/components/dl/VideoPlayer";
import { SITE } from "@/content/site";
import type { Episode } from "@/lib/queries";

/**
 * Six episodes, each playing in place.
 *
 * They used to link out to YouTube, on the reasoning that six live embeds is
 * about three megabytes on first paint and a tracking context set before
 * anyone has pressed play. That reasoning was right; the conclusion was too
 * blunt. VideoPlayer keeps both halves: what loads is a thumbnail, and the
 * iframe arrives only on the click that also starts playback.
 *
 * These thumbnails are NOT desaturated, unlike the photography elsewhere. A
 * YouTube still is a frame of the video itself, and greying it out makes a
 * cell that plays in colour look like it will not.
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
          <h2 className="m-0 text-display-md font-extrabold">
            From the stage.
          </h2>
        </Reveal>
        <Reveal index={1}>
          <ButtonAnchor
            href={SITE.socials.youtube}
            variant="outline"
            className="px-5 py-[14px]"
          >
            All episodes on YouTube
          </ButtonAnchor>
        </Reveal>
      </div>

      <div className="grid gap-[2px] border-b-2 border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((episode, i) => {
          const show = episode.showSlug
            ? showTitles[episode.showSlug]
            : undefined;
          return (
            <Reveal key={episode.videoId} index={i}>
              <VideoPlayer
                id={episode.videoId}
                title={episode.title}
                ratio="16/10"
              >
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
              </VideoPlayer>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
