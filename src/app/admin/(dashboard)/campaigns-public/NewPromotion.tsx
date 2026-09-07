"use client";

import { useState } from "react";
import { PromotionEditor } from "./PromotionEditor";

/**
 * The create form, collapsed until asked for.
 *
 * Open by default it would push the list of existing campaigns below the fold,
 * and the list is what this screen is opened to look at nine times out of ten.
 */
export function NewPromotion({
  shows,
}: {
  shows: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
      >
        New campaign
      </button>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="eyebrow">New campaign</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-quiet"
        >
          Cancel
        </button>
      </div>
      <div className="mt-5">
        <PromotionEditor shows={shows} onDone={() => setOpen(false)} />
      </div>
    </div>
  );
}
