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

/**
 * Status colours for the light ground.
 *
 * The previous set was tuned for the dark dashboard: sky-300, emerald-300 and
 * violet-300 land around 1.7:1 on white, which is a label you cannot read. The
 * 700 steps carry the same hue at a contrast that works on paper.
 *
 * NEW is the only one in brand red, because it is the only one that means
 * "somebody has to look at this".
 */
const STATUS_STYLE: Record<string, string> = {
  NEW: "border-brand bg-brand text-white",
  REVIEWED: "border-rule bg-white text-neutral-700",
  SHORTLISTED: "border-sky-700 bg-sky-50 text-sky-800",
  FINALIST: "border-emerald-700 bg-emerald-50 text-emerald-800",
  REJECTED: "border-neutral-300 bg-surface text-neutral-600",
  CONTACTED: "border-violet-700 bg-violet-50 text-violet-800",
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
      <div className="border border-rule bg-white p-14 text-center">
        <p className="text-neutral-700">No submissions match these filters.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Bulk bar only appears with a selection, so it never competes with the
          table for attention when it has nothing to do. */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border border-brand/30 bg-brand/5 px-5 py-3">
          <span className="text-sm text-ink">{selected.size} selected</span>

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
              const name = window.prompt(
                "Tag name to apply to the selected entries",
              );
              if (name?.trim()) runBulk({ tagName: name.trim() });
            }}
            className="btn btn-ghost !px-4 !py-2 !text-xs"
          >
            Add tag
          </button>

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs uppercase tracking-widest text-neutral-600 hover:text-brand"
          >
            Clear
          </button>

          {pending && (
            <span className="text-xs text-neutral-600">Applying…</span>
          )}
          {error && <span className="error-text !mt-0">{error}</span>}
        </div>
      )}

      <div className="overflow-x-auto border border-rule">
        <table className="w-full min-w-[62rem] text-left text-sm">
          <thead className="bg-white text-xs uppercase tracking-widest text-neutral-600">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() =>
                    setSelected(
                      allChecked ? new Set() : new Set(rows.map((r) => r.id)),
                    )
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
                  "border-t border-rule transition-colors hover:bg-white",
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
                    className="font-medium text-ink transition-colors hover:text-brand"
                  >
                    {r.firstName} {r.lastName ?? ""}
                  </Link>
                  {r.tags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span
                          key={t.tag.id}
                          className="border border-rule px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-600"
                        >
                          {t.tag.name}
                        </span>
                      ))}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-neutral-700">
                  {r.email}
                  {r.marketingOptIn && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-brand">
                      opt-in
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-neutral-700">
                  {r.type.charAt(0) + r.type.slice(1).toLowerCase()}
                  {r.show && (
                    <span className="block text-[11px] text-neutral-600">
                      {r.show.title}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-neutral-700">
                  {r.talentCategory ?? "—"}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {r.country ?? "—"}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-block  border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                      STATUS_STYLE[r.status] ?? STATUS_STYLE.REVIEWED,
                    )}
                  >
                    {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                  </span>
                </td>

                <td className="px-4 py-3 text-neutral-600">
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
