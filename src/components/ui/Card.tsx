import { cn } from "@/lib/cn";

export function Card({
  interactive = false,
  className,
  children,
  ...rest
}: { interactive?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(interactive ? "card-interactive" : "card", className)} {...rest}>
      {children}
    </div>
  );
}
