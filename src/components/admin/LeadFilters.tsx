"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { LEAD_TYPES, LEAD_STATUSES, LEAD_SOURCES } from "@/lib/admin/leads";

type Props = {
  shows: { id: string; title: string }[];
  countries: string[];
  tags: { id: string; name: string }[];
  total: number;
};

/**
 * Filters live entirely in the URL.
 *
 * That is what makes a view shareable — "here are the UK finalists for Drop That
 * Mike" is a link someone can paste to a colleague, bookmark, or hand to the
 * campaign composer in Phase 7, which reuses this exact filter shape to build a
 * saved Segment. Component state could do none of that.
 */
export function LeadFilters({ shows, countries, tags, total }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // Any filter change resets paging; page 3 of the old result set is
    // meaningless against a new one.
    next.delete("page");
    startTransition(() => router.push(`/admin/leads?${next.toString()}`));
  }

  const active = Array.from(sp.keys()).filter((k) => k !== "page").length > 0;

  return (
    <div className="rounded-card border border-ink-line bg-ink-soft p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="f-q">
            Search
          </label>
          <input
            id="f-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, phone, stage name"
            className="field"
          />
        </div>

        <Select
          id="f-type"
          label="Type"
          value={sp.get("type") ?? ""}
          onChange={(v) => apply({ type: v })}
          options={LEAD_TYPES.map((t) => ({ value: t, label: title(t) }))}
        />

        <Select
          id="f-status"
          label="Status"
          value={sp.get("status") ?? ""}
          onChange={(v) => apply({ status: v })}
          options={LEAD_STATUSES.map((t) => ({ value: t, label: title(t) }))}
        />

        <Select
          id="f-show"
          label="Show"
          value={sp.get("showId") ?? ""}
          onChange={(v) => apply({ showId: v })}
          options={shows.map((s) => ({ value: s.id, label: s.title }))}
        />

        <Select
          id="f-country"
          label="Country"
          value={sp.get("country") ?? ""}
          onChange={(v) => apply({ country: v })}
          options={countries.map((c) => ({ value: c, label: c }))}
        />

        <Select
          id="f-source"
          label="Source"
          value={sp.get("source") ?? ""}
          onChange={(v) => apply({ source: v })}
          options={LEAD_SOURCES.map((t) => ({ value: t, label: title(t) }))}
        />

        {tags.length > 0 && (
          <Select
            id="f-tag"
            label="Tag"
            value={sp.get("tag") ?? ""}
            onChange={(v) => apply({ tag: v })}
            options={tags.map((t) => ({ value: t.name, label: t.name }))}
          />
        )}

        <Select
          id="f-optin"
          label="Email opt-in"
          value={sp.get("optIn") ?? ""}
          onChange={(v) => apply({ optIn: v })}
          options={[
            { value: "yes", label: "Opted in" },
            { value: "no", label: "Not opted in" },
          ]}
        />

        <div>
          <label className="label" htmlFor="f-from">
            From
          </label>
          <input
            id="f-from"
            type="date"
            value={sp.get("from") ?? ""}
            onChange={(e) => apply({ from: e.target.value })}
            className="field w-[10rem]"
          />
        </div>

        <div>
          <label className="label" htmlFor="f-to">
            To
          </label>
          <input
            id="f-to"
            type="date"
            value={sp.get("to") ?? ""}
            onChange={(e) => apply({ to: e.target.value })}
            className="field w-[10rem]"
          />
        </div>

        <button type="submit" className="btn-primary !px-5 !py-2.5 !text-xs">
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-ink-line pt-4 text-xs">
        <span className="text-chalk-muted">
          {pending ? "Loading…" : `${total.toLocaleString("en-US")} matching`}
        </span>

        {active && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              startTransition(() => router.push("/admin/leads"));
            }}
            className="uppercase tracking-widest text-chalk-faint transition-colors hover:text-gold"
          >
            Clear filters
          </button>
        )}

        <a
          href={`/api/admin/leads/export?${sp.toString()}&format=csv`}
          className="uppercase tracking-widest text-chalk-faint transition-colors hover:text-gold"
        >
          Export CSV
        </a>
        <a
          href={`/api/admin/leads/export?${sp.toString()}&format=xlsx`}
          className="uppercase tracking-widest text-chalk-faint transition-colors hover:text-gold"
        >
          Export Excel
        </a>
      </div>
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field w-[10rem]"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function title(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}
