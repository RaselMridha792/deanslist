import { cn } from "@/lib/cn";

/** Grey panel, 4px red left rule. The success state for every form on the site. */
export function SuccessPanel({
  title,
  children,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("success-panel", className)} role="status">
      <p className="text-display-sm font-extrabold uppercase">{title}</p>
      {children && <div className="mt-3 text-body text-neutral-700">{children}</div>}
    </div>
  );
}
