import { cn } from "@/lib/cn";

/**
 * Two duplicated tracks translating 0 to -50%, so the loop is seamless.
 *
 * `aria-hidden` on the duplicate: the same words read twice by a screen reader
 * is noise, and the marquee is decorative repetition either way.
 */
export function Marquee({
  slow = false,
  className,
  children,
}: {
  slow?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex overflow-hidden", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center",
          slow ? "animate-dl-marquee-slow" : "animate-dl-marquee",
        )}
      >
        {children}
        <span aria-hidden className="flex shrink-0 items-center">
          {children}
        </span>
      </div>
    </div>
  );
}
