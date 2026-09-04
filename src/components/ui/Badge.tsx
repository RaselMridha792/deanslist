import { cn } from "@/lib/cn";

/**
 * `live` is the only variant allowed to animate, and red is reserved for it.
 * Everything else is a neutral chip.
 */
export function Badge({
  live = false,
  className,
  children,
}: {
  live?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (live) {
    return (
      <span className={cn("badge-live", className)}>
        <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-live" aria-hidden />
        {children}
      </span>
    );
  }
  return <span className={cn("badge", className)}>{children}</span>;
}
