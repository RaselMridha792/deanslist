import { cn } from "@/lib/cn";

/**
 * A CSS triangle, per the handoff: "play icons are CSS triangles". No glyph, no
 * icon font, no SVG — borders. It inherits currentColor so it works on any
 * ground without a variant.
 */
export function PlayIcon({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block", className)}
      style={{
        width: 0,
        height: 0,
        borderTop: `${size * 0.6}px solid transparent`,
        borderBottom: `${size * 0.6}px solid transparent`,
        borderLeft: `${size}px solid currentColor`,
      }}
    />
  );
}

/** The 44px outlined play square used over video thumbnails. */
export function PlaySquare({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-11 w-11 place-items-center border-2 border-current text-current",
        className,
      )}
    >
      <PlayIcon size={11} className="ml-[2px]" />
    </span>
  );
}
