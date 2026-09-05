"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteLead } from "@/app/admin/actions";

/**
 * Delete one submission, permanently.
 *
 * OWNER only, and the caller decides whether to render it at all; the server
 * action re-checks the role regardless, because a control that is merely not
 * drawn is not an authorisation boundary.
 *
 * The confirmation asks for the address rather than for a yes. A yes/no dialog
 * is answered by reflex from muscle memory, and the one thing that must not
 * happen here is deleting the wrong person's entry: typing the address means
 * the operator has read which row they are on. It is the same reason the bulk
 * control asks for the count.
 */
export function DeleteLeadButton({ leadId, email }: { leadId: string; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await deleteLead({ id: leadId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Back to the inbox: staying on the detail page of a row that no longer
      // exists would render a 404 the operator did not ask for.
      router.push("/admin/leads");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTyped("");
          setError(null);
        }}
        className="btn btn-ghost !px-0 !text-xs text-brand-onDark hover:underline"
      >
        Delete this entry
      </button>
    );
  }

  return (
    <div>
      <p className="text-sm text-admin-muted">
        This removes the submission, its tags and its campaign history from the
        database. It cannot be undone. The deletion is recorded in the audit log
        with the address, so an erasure request can still be evidenced.
      </p>

      <label className="label mt-4" htmlFor="delete-lead-confirm">
        Type the address to confirm
      </label>
      <input
        id="delete-lead-confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder={email}
        className="field !py-2 text-sm"
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase()}
          onClick={run}
          className="btn btn-primary !py-2 !text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Deleting" : "Delete permanently"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="btn btn-ghost !px-4 !py-2 !text-xs"
        >
          Cancel
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
