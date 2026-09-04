"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkUpdate } from "@/app/admin/actions";
import { LEAD_STATUSES } from "@/lib/admin/leads";
import { cn } from "@/lib/cn";

type Row = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  type: string;
  status: string;
  country: string | null;
  talentCategory: string | null;
  createdAt: string;
  marketingOptIn: boolean;
  show: { title: string } | null;
  tags: { tag: { id: string; name: string } }[];
};

const STATUS_STYLE: Record<string, string> = {
  NEW: "border-brand/40 bg-brand/10 text-brand",
  REVIEWED: "border-ink-edge bg-ink-high text-chalk-muted",
  SHORTLISTED: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  FINALIST: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  REJECTED: "border-ink-edge bg-ink-high text-chalk-faint",
  CONTACTED: "border-violet-400/40 bg-violet-400/10 text-violet-300",
};

export function LeadTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allChecked = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(patch: { status?: string; tagName?: string }) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setError(null);
    startTransition(async () => {
      const res = await bulkUpdate({ ids, ...patch });
      if (!res.ok) setError(res.error);
      else {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-ink-line bg-ink-soft p-14 text-center">
        <p className="text-chalk-muted">No submissions match these filters.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Bulk bar only appears with a selection, so it never competes with the
          table for attention when it has nothing to do. */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-brand/30 bg-brand/5 px-5 py-3">
          <span className="text-sm text-chalk">
            {selected.size} selected
          </span>

          <select
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              if (e.target.value) runBulk({ status: e.target.value });
              e.target.value = "";
            }}
            className="field w-[12rem] !py-2 text-xs"
            aria-label="Set status for selected"
          >
            <option value="">Set status…</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const name = window.prompt("Tag name to apply to the selected entries");
              if (name?.trim()) runBulk({ tagName: name.trim() });
            }}
            className="btn-ghost !px-4 !py-2 !text-xs"
          >
            Add tag
          </button>

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs uppercase tracking-widest text-chalk-faint hover:text-brand"
          >
            Clear
          </button>

          {pending && <span className="text-xs text-chalk-faint">Applying…</span>}
          {error && <span className="error-text !mt-0">{error}</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-ink-line">
        <table className="w-full min-w-[62rem] text-left text-sm">
          <thead className="bg-ink-soft text-xs uppercase tracking-widest text-chalk-faint">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() =>
                    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))
                  }
                  aria-label="Select all on this page"
                  className="h-4 w-4 accent-brand"
                />
              </th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Talent</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Received</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={cn(
                  "border-t border-ink-line transition-colors hover:bg-ink-soft",
                  selected.has(r.id) && "bg-brand/5",
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`Select ${r.firstName}`}
                    className="h-4 w-4 accent-brand"
                  />
                </td>

                <td className="px-4 py-3">
                  <Link
                    href={`/admin/leads/${r.id}`}
                    className="font-medium text-chalk transition-colors hover:text-brand"
                  >
                    {r.firstName} {r.lastName ?? ""}
                  </Link>
                  {r.tags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span
                          key={t.tag.id}
                          className="rounded-full border border-ink-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-chalk-faint"
                        >
                          {t.tag.name}
                        </span>
                      ))}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-chalk-muted">
                  {r.email}
                  {r.marketingOptIn && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-brand">
                      opt-in
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-chalk-muted">
                  {r.type.charAt(0) + r.type.slice(1).toLowerCase()}
                  {r.show && (
                    <span className="block text-[11px] text-chalk-faint">{r.show.title}</span>
                  )}
                </td>

                <td className="px-4 py-3 text-chalk-muted">{r.talentCategory ?? "—"}</td>
                <td className="px-4 py-3 text-chalk-muted">{r.country ?? "—"}</td>

                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-block rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                      STATUS_STYLE[r.status] ?? STATUS_STYLE.REVIEWED,
                    )}
                  >
                    {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                  </span>
                </td>

                <td className="px-4 py-3 text-chalk-faint">
                  {new Date(r.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
