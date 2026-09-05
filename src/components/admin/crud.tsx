"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared building blocks for every content manager screen.
 *
 * The Content Manager covers seven entities. Written one screen at a time they
 * would drift into seven slightly different save behaviours and seven ways of
 * reporting an error, which is exactly how a dashboard stops feeling like one
 * product. These are the pieces they all use.
 */

export type ActionResult =
  { ok: true; id?: string } | { ok: false; error: string };

/* ------------------------------------------------------------------ shell */

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-admin-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-admin-line-strong bg-admin-panel p-14 text-center">
      <p className="font-display text-2xl uppercase tracking-wide text-admin-text">
        {title}
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-admin-muted">
        {body}
      </p>
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ fields */

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
  help,
  span,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
  help?: string;
  span?: boolean;
}) {
  const id = `f-${name}`;
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label className="label" htmlFor={id}>
        {label} {required && <span className="text-brand-onDark">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className="field"
      />
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 5,
  required,
  help,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  required?: boolean;
  help?: string;
  placeholder?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="sm:col-span-2">
      <label className="label" htmlFor={id}>
        {label} {required && <span className="text-brand-onDark">*</span>}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className="field resize-y"
      />
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  required,
  help,
  placeholder = "Select one",
}: {
  label: string;
  name: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string | null;
  required?: boolean;
  help?: string;
  placeholder?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label} {required && <span className="text-brand-onDark">*</span>}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="field"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function Checkbox({
  label,
  name,
  defaultChecked,
  help,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  help?: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-admin-muted sm:col-span-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-brand"
      />
      <span>
        {label}
        {help && (
          <span className="mt-0.5 block text-xs text-admin-faint">{help}</span>
        )}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------- form */

/**
 * Wraps a server action in the one save behaviour every screen uses: disable
 * while pending, surface the error inline rather than throwing, and only
 * navigate on success.
 */
export function CrudForm({
  action,
  submitLabel = "Save",
  redirectTo,
  children,
  onSaved,
}: {
  action: (data: FormData) => Promise<ActionResult>;
  submitLabel?: string;
  redirectTo?: string;
  children: React.ReactNode;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        setSaved(false);
        start(async () => {
          const res = await action(data);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setSaved(true);
          onSaved?.();
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        });
      }}
      className="grid gap-5 sm:grid-cols-2"
    >
      {children}

      {error && (
        <p className="error-text sm:col-span-2" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {saved && !pending && (
          <span className="text-xs text-admin-faint">Saved</span>
        )}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ delete */

/**
 * Destructive actions confirm by name, not by an OK button. "Are you sure?" is
 * clicked through reflexively; typing the title is not.
 */
export function DeleteButton({
  action,
  name,
  label = "Delete",
  redirectTo,
}: {
  action: () => Promise<ActionResult>;
  name: string;
  label?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const typed = window.prompt(
            `This cannot be undone. Type the name to confirm:\n\n${name}`,
          );
          if (typed?.trim() !== name.trim()) return;
          setError(null);
          start(async () => {
            const res = await action();
            if (!res.ok) setError(res.error);
            else if (redirectTo) router.push(redirectTo);
            else router.refresh();
          });
        }}
        className="text-xs font-semibold uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark disabled:opacity-50"
      >
        {pending ? "Deleting…" : label}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- table */

export function AdminTable({
  head,
  children,
}: {
  head: string[];
  children: React.ReactNode;
}) {
  return (
    /*
      Three separate jobs, three different weights:

        the outline  is an EDGE, so line-strong (3.4:1). A panel fill is only
                     1.10:1 against the page here, so nothing but the border
                     tells you where the table stops.
        the header   is a band, so it steps up to `raised` and is closed by a
                     2px line-strong rule. Raised on panel is 1.12:1 on its
                     own — it is the rule, not the fill, that makes the header
                     read as a header on this ground.
        the row rules stay `line` (2:1), quiet enough not to stripe a long
                     table. They live on Row below.
    */
    <div className="overflow-x-auto border border-admin-line-strong bg-admin-panel">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="bg-admin-sunk text-xs uppercase tracking-widest text-admin-faint">
          <tr className="border-b-2 border-admin-line-strong">
            {head.map((h) => (
              <th key={h} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-t border-admin-line-strong transition-colors hover:bg-admin-raised">
      {children}
    </tr>
  );
}

export function Cell({
  children,
  muted,
  className,
}: {
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3", muted && "text-admin-muted", className)}>
      {children}
    </td>
  );
}

export function RowLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-admin-text transition-colors hover:text-brand-onDark"
    >
      {children}
    </Link>
  );
}

export function StatusPill({
  value,
  tone,
}: {
  value: string;
  tone?: "good" | "warn" | "mute";
}) {
  return (
    <span
      className={cn(
        "pill",
        tone === "good" && "border-admin-ok/60 bg-admin-ok-tint text-admin-ok",
        tone === "warn" && "border-brand bg-brand text-white",
        (!tone || tone === "mute") && "border-admin-line-strong bg-admin-raised text-admin-muted",
      )}
    >
      {value}
    </span>
  );
}

/** Datetime-local wants "YYYY-MM-DDTHH:mm" and rejects a full ISO string. */
export function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
