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
 * Status colours for the dark ground, drawn from the admin status tokens.
 *
 * Each chip is edge-first: the tint fill is around 1.3:1 here and is a hint,
 * not the signal, so the border at /60 is what actually separates the chip
 * from the row. The roles map onto the pipeline — a lead in motion is `info`,
 * a settled good outcome is `ok`, a fact worth marking is `note`.
 *
 * NEW is the only one in brand red, because it is the only one that means
 * "somebody has to look at this".
 */
const STATUS_STYLE: Record<string, string> = {
  NEW: "border-brand bg-brand text-white",
  REVIEWED: "border-admin-line-strong bg-admin-raised text-admin-muted",
  SHORTLISTED: "border-admin-info/60 bg-admin-info-tint text-admin-info",
  FINALIST: "border-admin-ok/60 bg-admin-ok-tint text-admin-ok",
  REJECTED: "border-admin-line-strong bg-admin-raised text-admin-faint",
  CONTACTED: "border-admin-note/60 bg-admin-note-tint text-admin-note",
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
      <div className="border border-admin-line-strong bg-admin-panel p-14 text-center">
        <p className="text-admin-muted">No submissions match these filters.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Bulk bar only appears with a selection, so it never competes with the
          table for attention when it has nothing to do. */}
      {selected.size > 0 && (
        <div className="notice-strong mb-4 flex flex-wrap items-center gap-3 px-5 py-3">
          <span className="text-sm text-admin-text">{selected.size} selected</span>

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
            className="text-xs uppercase tracking-widest text-admin-faint hover:text-brand-onDark"
          >
            Clear
          </button>

          {pending && (
            <span className="text-xs text-admin-faint">Applying…</span>
          )}
          {error && <span className="error-text !mt-0">{error}</span>}
        </div>
      )}

      {/* Same structure as AdminTable in crud.tsx: line-strong outline because
          the panel fill is only 1.10:1 on the page and the edge is doing all of
          the work, a raised header band closed by a 2px line-strong rule, and
          quiet `line` rules between rows so a long table does not stripe. */}
      <div className="overflow-x-auto border border-admin-line-strong bg-admin-panel">
        <table className="w-full min-w-[62rem] text-left text-sm">
          <thead className="bg-admin-sunk text-xs uppercase tracking-widest text-admin-faint">
            <tr className="border-b-2 border-admin-line-strong">
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
                data-selected={selected.has(r.id) || undefined}
                className={cn(
                  "border-t border-admin-line transition-colors",
                  /*
                    Selection has to survive hover. `bg-brand/15` was 1.07:1 on
                    this ground and `hover:bg-admin-raised` overwrote what little
                    of it there was, so a hovered row looked selected and a
                    selected row looked hovered — on the only control that says
                    which rows a bulk status change will hit.

                    So: an opaque raised ground the hover repeats rather than
                    replaces, plus a 4px red rule down the left edge that hover
                    cannot touch. The transparent rule on unselected rows keeps
                    the first cell from shifting 4px as rows are ticked. Both
                    branches carry a border-left-colour, so the two utilities
                    never race each other in the cascade.
                  */
                  selected.has(r.id)
                    ? "border-l-4 border-l-brand-onDark bg-admin-raised hover:bg-admin-raised"
                    : "border-l-4 border-l-transparent hover:bg-admin-raised",
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
                    className="font-medium text-admin-text transition-colors hover:text-brand-onDark"
                  >
                    {r.firstName} {r.lastName ?? ""}
                  </Link>
                  {r.tags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span
                          key={t.tag.id}
                          className="border border-admin-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-admin-faint"
                        >
                          {t.tag.name}
                        </span>
                      ))}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-admin-muted">
                  {r.email}
                  {r.marketingOptIn && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-onDark">
                      opt-in
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-admin-muted">
                  {r.type.charAt(0) + r.type.slice(1).toLowerCase()}
                  {r.show && (
                    <span className="block text-[11px] text-admin-faint">
                      {r.show.title}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-admin-muted">
                  {r.talentCategory ?? "—"}
                </td>
                <td className="px-4 py-3 text-admin-muted">
                  {r.country ?? "—"}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "pill",
                      STATUS_STYLE[r.status] ?? STATUS_STYLE.REVIEWED,
                    )}
                  >
                    {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                  </span>
                </td>

                <td className="px-4 py-3 text-admin-faint">
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
