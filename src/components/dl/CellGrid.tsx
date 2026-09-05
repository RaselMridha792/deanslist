import { cn } from "@/lib/cn";
import { Reveal } from "@/components/dl/Reveal";

/**
 * Equal-width cells separated by 2px rules.
 *
 * The rules are a background showing through a 2px gap, not per-cell borders.
 * That way the outer edges carry no rule, the last cell needs no override, and
 * a row that wraps still separates correctly.
 */
export function CellGrid({
  cols = 4,
  onDark = false,
  className,
  children,
}: {
  cols?: 2 | 3 | 4;
  onDark?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const colClass =
    cols === 2
      ? "sm:grid-cols-2"
      : cols === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn(onDark ? "cells-dark" : "cells", colClass, className)}>{children}</div>
  );
}

export function Cell({
  index = 0,
  onDark = false,
  className,
  children,
}: {
  index?: number;
  onDark?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal index={index} className={cn(onDark ? "cell-dark" : "cell", className)}>
      {children}
    </Reveal>
  );
}
