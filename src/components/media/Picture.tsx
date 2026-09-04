import { cn } from "@/lib/cn";
import { media } from "@/lib/media";

type Props = {
  /** Path without an extension, e.g. "/media/gallery/cts-01". */
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
  /** Above the fold. Skips lazy loading and hints the preload scanner. */
  priority?: boolean;
  sizes?: string;
};

/**
 * Serves the AVIF/WebP/JPEG set produced by scripts/optimize-images.mjs.
 *
 * Deliberately a plain <picture> rather than next/image: these files are already
 * sized and compressed at build time, so the optimiser would re-encode assets
 * that are 20-90 KB to begin with, and on a single small VPS that runs on the
 * same CPU serving requests.
 *
 * `alt` is required, not optional — decorative images should pass alt="".
 */
export function Picture({
  src,
  alt,
  className,
  imgClassName,
  width,
  height,
  priority = false,
  sizes,
}: Props) {
  const isBrand = src.includes("/brand/");
  const base = media(src);
  const fallback = isBrand ? `${base}.png` : `${base}.jpg`;

  return (
    <picture className={className}>
      <source srcSet={`${base}.avif`} type="image/avif" sizes={sizes} />
      <source srcSet={`${base}.webp`} type="image/webp" sizes={sizes} />
      <img
        src={fallback}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : undefined}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </picture>
  );
}
