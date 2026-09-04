import { Picture } from "@/components/media/Picture";
import { cn } from "@/lib/cn";

type Props = {
  name: string;
  photoUrl: string | null;
  /** Show key art, used as the backdrop when there is no portrait. */
  fallbackImage?: string | null;
  priority?: boolean;
  sizes?: string;
  className?: string;
};

/**
 * A winner's portrait, or an intentional stand-in when there is not one.
 *
 * This exists because of a real editorial constraint: the old site publishes no
 * photograph of its winner, only the site logo, so there is nothing to carry
 * over — and putting an unidentified person from the gallery under a named
 * winner's story is not an option.
 *
 * The first attempt rendered a grey box with a faint initial, which read as a
 * broken image rather than a deliberate choice. This instead treats the absence
 * as a design: the show's own key art, pushed back behind a scrim, with the
 * initial set in metal and a line that says a portrait is coming. It looks
 * finished, and it stops looking like a bug.
 */
export function WinnerPortrait({
  name,
  photoUrl,
  fallbackImage,
  priority = false,
  sizes,
  className,
}: Props) {
  if (photoUrl) {
    return (
      <div className={cn("relative overflow-hidden rounded-card border border-ink-line", className)}>
        <Picture src={photoUrl} alt={name} priority={priority} sizes={sizes} />
        <span className="absolute inset-x-0 bottom-0 h-px bg-gold-hairline" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-card border border-ink-line",
        className,
      )}
    >
      {fallbackImage && (
        <div className="absolute inset-0 -z-20 opacity-25">
          <Picture src={fallbackImage} alt="" priority={priority} sizes={sizes} />
        </div>
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/85 to-ink" />

      <div className="flex h-full flex-col items-center justify-center gap-5 p-10 text-center">
        <span
          aria-hidden
          className="grid h-28 w-28 place-items-center rounded-full border border-gold/30"
        >
          <span className="font-display text-6xl leading-none text-metal">
            {name.trim().charAt(0).toUpperCase()}
          </span>
        </span>
        <p className="text-eyebrow uppercase text-chalk-faint">Portrait to follow</p>
      </div>

      <span className="absolute inset-x-0 bottom-0 h-px bg-gold-hairline" />
    </div>
  );
}
