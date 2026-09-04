"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLeadStatus, setLeadNotes, addTag, removeTag } from "@/app/admin/actions";
import { LEAD_STATUSES } from "@/lib/admin/leads";

type Props = {
  leadId: string;
  status: string;
  notes: string;
  tags: { id: string; name: string }[];
};

/**
 * Status, notes and tags for one lead.
 *
 * Notes save on an explicit button rather than on blur: a reviewer's note is the
 * one field here they might spend a minute writing, and losing it to an
 * accidental click elsewhere is worse than an extra press.
 */
export function LeadDetailPanel({ leadId, status, notes, tags }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [noteText, setNoteText] = useState(notes);
  const [noteSaved, setNoteSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = noteText !== notes;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <label className="label" htmlFor="lead-status">
          Status
        </label>
        <select
          id="lead-status"
          value={status}
          disabled={pending}
          onChange={(e) => run(() => setLeadStatus({ id: leadId, status: e.target.value }))}
          className="field"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="label">Tags</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-2 rounded-full border border-ink-edge bg-ink-high px-3 py-1 text-xs text-chalk-muted"
            >
              {t.name}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeTag({ leadId, tagId: t.id }))}
                aria-label={`Remove tag ${t.name}`}
                className="text-chalk-faint transition-colors hover:text-live"
              >
                ×
              </button>
            </span>
          ))}

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const name = window.prompt("Tag name");
              if (name?.trim()) run(() => addTag({ leadId, name: name.trim() }));
            }}
            className="rounded-full border border-dashed border-ink-edge px-3 py-1 text-xs text-chalk-faint transition-colors hover:border-brand hover:text-brand"
          >
            + Add tag
          </button>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="lead-notes">
          Internal notes
        </label>
        <textarea
          id="lead-notes"
          rows={6}
          value={noteText}
          disabled={pending}
          onChange={(e) => {
            setNoteText(e.target.value);
            setNoteSaved(false);
          }}
          placeholder="Only the team sees this."
          className="field resize-y"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={() =>
              run(async () => {
                const res = await setLeadNotes({ id: leadId, notes: noteText });
                if (res.ok) setNoteSaved(true);
                return res;
              })
            }
            className="btn-primary !px-5 !py-2.5 !text-xs disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save note"}
          </button>
          {noteSaved && !dirty && <span className="text-xs text-chalk-faint">Saved</span>}
        </div>
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
