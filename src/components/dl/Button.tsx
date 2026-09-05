import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "outline-dark" | "ghost" | "ghost-dark";

const VARIANT: Record<Variant, string> = {
  primary: "btn btn-primary",
  outline: "btn btn-outline",
  "outline-dark": "btn btn-outline-dark",
  ghost: "btn btn-ghost",
  "ghost-dark": "btn btn-ghost-dark",
};

/**
 * Labels are flush left, never centred — `.btn` sets justify-start and nothing
 * here should override it. It is the most identifiable thing about this system.
 */
export function ButtonLink({
  variant = "primary",
  size,
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: "lg";
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link className={cn(VARIANT[variant], size === "lg" && "btn-lg", className)} {...rest}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  size,
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: "lg";
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  return (
    <button className={cn(VARIANT[variant], size === "lg" && "btn-lg", className)} {...rest}>
      {children}
    </button>
  );
}

/** External link with the same treatment. */
export function ButtonAnchor({
  variant = "outline",
  size,
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: "lg";
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children">) {
  return (
    <a
      className={cn(VARIANT[variant], size === "lg" && "btn-lg", className)}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  );
}
