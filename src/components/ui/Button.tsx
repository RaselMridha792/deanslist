import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "quiet";
type Size = "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  quiet: "btn-quiet",
};

const SIZE: Record<Size, string> = {
  md: "",
  lg: "px-9 py-4 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

type LinkProps = CommonProps &
  Omit<React.ComponentProps<typeof Link>, "className" | "children">;

/**
 * One button, three weights. `quiet` has no box, so `size` does not apply to it.
 */
export function Button({ variant = "primary", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(VARIANT[variant], variant !== "quiet" && SIZE[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, children, ...rest }: LinkProps) {
  return (
    <Link
      className={cn(VARIANT[variant], variant !== "quiet" && SIZE[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
