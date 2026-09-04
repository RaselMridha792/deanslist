import { cn } from "@/lib/cn";

type Props = {
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
  children?: React.ReactNode;
};

/**
 * The standard section opener: small gold label, display heading, optional lede.
 * Keeping it in one component is what stops eight sections drifting into eight
 * slightly different heading treatments.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  as: Tag = "h2",
  className,
  children,
}: Props) {
  const centered = align === "center";

  return (
    <div className={cn(centered && "mx-auto text-center", centered ? "max-w-2xl" : "max-w-3xl", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Tag
        className={cn(
          "mt-3 uppercase",
          Tag === "h1" ? "text-display-lg" : "text-display-md",
        )}
      >
        {title}
      </Tag>
      {lede && (
        <p className={cn("mt-4 text-body-lg text-chalk-muted", centered ? "mx-auto" : "", "max-w-prose")}>
          {lede}
        </p>
      )}
      {children}
    </div>
  );
}
