import { mediaImage, mediaVideo } from "@/lib/media";
import { cn } from "@/lib/cn";

/**
 * Photography on this site is grayscale, which is why it lives here rather
 * than in a utility class applied by hand: one missed class is a colour image
 * in a monochrome page and it reads as a bug.
 *
 * Moving footage is the exception, and a deliberate one. The homepage clip
 * reel is nine performances, and the claim that strip makes is that these are
 * real people on a real stage. Desaturated, it reads as archive. So
 * GrayscaleClip takes `color`.
 *
 * `src` is an extensionless path ("/media/gallery/cts-01"); the media helpers
 * resolve it against Cloudinary or /public. The AVIF and WebP sources are
 * derived by Cloudinary from the JPEG.
 */
export function GrayscaleImage({
  src,
  alt,
  ratio,
  priority = false,
  sizes,
  hover = true,
  className,
}: {
  src: string;
  alt: string;
  /** e.g. "4/5", "16/10", "9/16". Applied to the frame, not the image. */
  ratio?: string;
  priority?: boolean;
  sizes?: string;
  /** Scale on hover, per the design's 1.04-1.05 over 1.2s. */
  hover?: boolean;
  className?: string;
}) {
  const base = mediaImage(src);
  return (
    <div
      className={cn("relative overflow-hidden bg-neutral-300", className)}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      <picture>
        <source srcSet={`${base}.avif`} type="image/avif" sizes={sizes} />
        <source srcSet={`${base}.webp`} type="image/webp" sizes={sizes} />
        <img
          src={`${base}.jpg`}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : undefined}
          className={cn(
            "grayscale-media h-full w-full object-cover",
            hover &&
              "transition-transform duration-[1200ms] ease-dl group-hover:scale-[1.05]",
          )}
        />
      </picture>
    </div>
  );
}

/**
 * A looping muted clip used as texture. Poster first, video attached lazily.
 *
 * `preload="none"` plus a poster means the still is what loads; the file itself
 * only arrives when the browser decides to. Nine of these autoplay on the
 * homepage clip reel, so eager loading would be nine simultaneous downloads.
 */
export function GrayscaleClip({
  src,
  ratio = "9/16",
  label,
  color = false,
  className,
}: {
  src: string;
  ratio?: string;
  label?: string;
  /** Render the footage in its own colour instead of the site's grayscale. */
  color?: boolean;
  className?: string;
}) {
  const v = mediaVideo(src);
  const poster = mediaImage(src);
  return (
    <div
      className={cn("group relative overflow-hidden bg-neutral-900", className)}
      style={{ aspectRatio: ratio }}
    >
      <video
        poster={`${poster}.jpg`}
        muted
        loop
        playsInline
        autoPlay
        preload="none"
        aria-hidden
        tabIndex={-1}
        className={cn(
          "h-full w-full object-cover",
          !color && "grayscale-media",
        )}
      >
        <source src={`${v}.webm`} type="video/webm" />
        <source src={`${v}.mp4`} type="video/mp4" />
      </video>
      {label && (
        <span className="absolute bottom-3 left-3 text-eyebrow font-semibold uppercase text-white">
          {label}
        </span>
      )}
    </div>
  );
}
