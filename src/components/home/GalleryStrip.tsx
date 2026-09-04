import { SectionHeading } from "@/components/ui/SectionHeading";
import { Picture } from "@/components/media/Picture";

export function GalleryStrip({ images }: { images: { url: string; alt: string }[] }) {
  if (images.length === 0) return null;

  return (
    <section className="section border-b border-ink-line">
      <div className="shell">
        <SectionHeading eyebrow="The room" title="Moments from the season" align="center" />
      </div>

      {/* Full-bleed and horizontally scrollable on small screens, so the images
          keep their scale instead of shrinking into thumbnails. */}
      <div className="mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 md:px-8">
        {images.map((img, i) => (
          <div
            key={img.url}
            className="relative aspect-[3/4] w-64 shrink-0 snap-start overflow-hidden rounded-card border border-ink-line sm:w-72"
          >
            <Picture src={img.url} alt={img.alt} priority={i < 2} sizes="288px" />
          </div>
        ))}
      </div>
    </section>
  );
}
