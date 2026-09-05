import { cn } from "@/lib/cn";

/**
 * The 11px uppercase label above every section heading.
 *
 * `onDark` is not a style preference: #d40000 on #201e1d is around 2.6:1, well
 * under the 4.5:1 body-text threshold, so dark sections use #ff5a4a instead.
 */
export function Kicker({
  children,
  onDark = false,
  className,
}: {
  children: React.ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return <p className={cn(onDark ? "kicker-dark" : "kicker", className)}>{children}</p>;
}
