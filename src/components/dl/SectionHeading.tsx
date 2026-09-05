import { cn } from "@/lib/cn";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";

/**
 * The section pattern: kicker, display heading, 2px rule.
 *
 * `aside` renders opposite the heading on wide screens — the design uses a
 * 5fr / 7fr split for that row on several pages.
 */
export function SectionHeading({
  kicker,
  title,
  aside,
  onDark = false,
  as: Tag = "h2",
  size = "md",
  className,
}: {
  kicker?: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  onDark?: boolean;
  as?: "h1" | "h2" | "h3";
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClass =
    size === "xl" ? "text-display-xl" : size === "lg" ? "text-display-lg" : "text-display-md";

  return (
    <div className={className}>
      <div className={cn("grid gap-6", Boolean(aside) && "lg:grid-cols-[5fr_7fr] lg:gap-12")}>
        <Reveal>
          {kicker && <Kicker onDark={onDark}>{kicker}</Kicker>}
          <Tag className={cn("mt-4 font-extrabold uppercase text-balance", sizeClass)}>{title}</Tag>
        </Reveal>
        {aside && (
          <Reveal index={1} className="self-end">
            {aside}
          </Reveal>
        )}
      </div>
      <div className={cn("mt-8", onDark ? "divider-dark" : "divider")} />
    </div>
  );
}
