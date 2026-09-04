import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { VideoEmbed } from "@/components/media/VideoEmbed";
import type { Episode } from "@/lib/queries";

export function VideoHighlights({ episodes }: { episodes: Episode[] }) {
  if (episodes.length === 0) return null;
  const shown = episodes.slice(0, 6);

  return (
    <section className="section border-b border-ink-line bg-ink-raised">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Watch"
            title="From the stage"
            lede="Full episodes and highlights from every season."
          />
          <ButtonLink href="/watch" variant="ghost">All episodes</ButtonLink>
        </div>

        {/* Thumbnails only. Six live iframes would cost roughly three megabytes
            and set six tracking contexts before anyone pressed play. */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => (
            <VideoEmbed key={e.videoId} videoId={e.videoId} title={e.title} />
          ))}
        </div>
      </div>
    </section>
  );
}
