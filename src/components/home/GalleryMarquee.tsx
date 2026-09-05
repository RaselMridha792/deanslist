import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Marquee } from "@/components/dl/Marquee";

/**
 * A grey band of 4:5 stills drifting at 60s, twice as slow as the ticker so the
 * two never read as the same device.
 *
 * Twelve is the design's count and the point at which the duplicated track is
 * wide enough to loop without a visible seam on a large screen.
 */
export function GalleryMarquee({ images }: { images: { url: string; alt: string }[] }) {
  if (images.length === 0) return null;
  const shown = images.slice(0, 12);

  return (
    <section className="mt-section-lg overflow-hidden border-y-2 border-rule bg-surface">
      <div className="mx-auto flex max-w-shell flex-wrap justify-between gap-6 px-gutter py-[clamp(20px,2.5vw,32px)] text-kicker font-semibold uppercase text-brand-onLight">
        <span>04 / The room</span>
        <span className="text-neutral-700">Moments from the season</span>
      </div>

      <Marquee slow className="pb-[2px]">
        <div className="flex shrink-0 gap-[2px] pr-[2px]">
          {shown.map((image) => (
            <GrayscaleImage
              key={image.url}
              src={image.url}
              alt={image.alt}
              ratio="4/5"
              hover={false}
              className="h-[clamp(200px,24vw,360px)] w-auto shrink-0"
            />
          ))}
        </div>
      </Marquee>
    </section>
  );
}
