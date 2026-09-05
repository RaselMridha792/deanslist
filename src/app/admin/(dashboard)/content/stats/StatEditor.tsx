"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewStat, saveStat, unverifyStat } from "@/app/admin/content-actions";
import { Checkbox, CrudForm, Field } from "@/components/admin/crud";

/**
 * Colocated with the route rather than dropped into src/components/admin,
 * because nothing else needs it: it exists only to give the statistics screen
 * two things a Server Component cannot do — a preview that updates while you
 * type, and a confirmation step that appears the moment "verified" is ticked.
 */

export type StatDraft = {
  id: string;
  key: string;
  label: string;
  value: number;
  prefix: string | null;
  suffix: string | null;
  displayAs: string | null;
  verified: boolean;
  active: boolean;
  sortOrder: number;
};

/* ------------------------------------------------------------------ editor */

export function StatEditor({
  stat,
  nextOrder,
  initialPreview,
  redirectTo,
}: {
  stat: StatDraft | null;
  nextOrder: number;
  initialPreview: string;
  redirectTo: string;
}) {
  const wasVerified = stat?.verified ?? false;

  const [label, setLabel] = useState(stat?.label ?? "");
  const [value, setValue] = useState(stat ? String(stat.value) : "");
  const [prefix, setPrefix] = useState(stat?.prefix ?? "");
  const [suffix, setSuffix] = useState(stat?.suffix ?? "");
  const [verified, setVerified] = useState(wasVerified);

  const [preview, setPreview] = useState(initialPreview);
  const [previewStale, setPreviewStale] = useState(false);

  /**
   * The preview is rendered by the server so it runs the same formatStat() the
   * public pages run — a second copy of the rule in the browser is exactly how a
   * preview starts lying. Debounced, because it is one request per pause in
   * typing on an admin screen, not per keystroke.
   */
  useEffect(() => {
    let cancelled = false;
    setPreviewStale(true);

    const timer = setTimeout(() => {
      const parsed = Number(value);
      previewStat({
        value: Number.isFinite(parsed) ? parsed : 0,
        prefix: prefix.trim() || undefined,
        suffix: suffix.trim() || undefined,
      })
        .then((next) => {
          if (cancelled) return;
          setPreview(next);
          setPreviewStale(false);
        })
        .catch(() => {
          if (!cancelled) setPreviewStale(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, prefix, suffix]);

  const goingPublic = verified && !wasVerified;
  const comingDown = !verified && wasVerified;

  return (
    <CrudForm
      action={saveStat}
      submitLabel={stat ? "Save changes" : "Add statistic"}
      redirectTo={redirectTo}
    >
      {stat && <input type="hidden" name="id" value={stat.id} />}

      <Field
        label="Key"
        name="key"
        required
        defaultValue={stat?.key}
        placeholder="youtube_subscribers"
        help="Permanent identifier. Lowercase letters, numbers and underscores."
      />

      <div>
        <label className="label" htmlFor="f-label">
          Label <span className="text-brand-onDark">*</span>
        </label>
        <input
          id="f-label"
          name="label"
          required
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="YouTube subscribers"
          className="field"
        />
        <p className="help">The words under the number.</p>
      </div>

      <div>
        <label className="label" htmlFor="f-value">
          Value <span className="text-brand-onDark">*</span>
        </label>
        <input
          id="f-value"
          name="value"
          type="number"
          required
          min={0}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="700000"
          className="field tabular-nums"
        />
        <p className="help">
          The whole number. Formatting is applied for you — never type
          &ldquo;700K&rdquo; here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="f-prefix">
            Prefix
          </label>
          <input
            id="f-prefix"
            name="prefix"
            maxLength={4}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="$"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="f-suffix">
            Suffix
          </label>
          <input
            id="f-suffix"
            name="suffix"
            maxLength={4}
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            placeholder="+"
            className="field"
          />
        </div>
        <p className="help col-span-2">
          A prefix makes this a money figure, and money never abbreviates:
          &ldquo;$1,000&rdquo; stays &ldquo;$1,000&rdquo;. Counts only abbreviate from 10,000
          up.
        </p>
      </div>

      {/* --------------------------------------------------------- preview */}
      <div className="sm:col-span-2">
        <p className="eyebrow">Exactly how it will render</p>
        <div className="mt-3 border border-admin-line-strong bg-admin-raised px-6 py-7">
          <p
            className={`font-display text-5xl leading-none text-brand-onDark transition-opacity duration-200 ease-dl ${
              previewStale ? "opacity-40" : "opacity-100"
            }`}
            aria-live="polite"
          >
            {preview}
          </p>
          <p className="mt-2 text-eyebrow uppercase text-admin-faint">
            {label.trim() || "Label goes here"}
          </p>
        </div>
        <p className="help">
          Rendered by the same code the public stats band uses, so what you see here is what
          visitors see. The old site animated its counter from an empty value and shipped
          &ldquo;.7Mil+&rdquo; and a bare &ldquo;K&rdquo; — this never renders a partial
          number.
        </p>
      </div>

      <Field
        label="Order"
        name="sortOrder"
        type="number"
        defaultValue={stat?.sortOrder ?? nextOrder}
        help="Low numbers first, left to right in the band."
      />

      <Field
        label="Display override"
        name="displayAs"
        defaultValue={stat?.displayAs}
        placeholder="Leave blank"
        help="Stored but not currently read by the public site — the band always renders the formatted figure above. Leave blank."
      />

      <Checkbox
        label="Active — include this statistic in the band"
        name="active"
        defaultChecked={stat ? stat.active : true}
        help="Switched off, it is hidden regardless of whether it has been verified."
      />

      {/* ------------------------------------------------ the verified gate */}
      <div className="sm:col-span-2">
        <label className="flex items-start gap-3 text-sm text-admin-muted">
          <input
            type="checkbox"
            name="verified"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            Verified — publish this figure on the public site
            <span className="mt-0.5 block text-xs text-admin-faint">
              Unverified figures are stored here and never sent to a visitor. This is the only
              switch that puts the number in public.
            </span>
          </span>
        </label>
      </div>

      {goingPublic && (
        <div className="notice-strong sm:col-span-2">
          <p className="text-sm font-semibold text-brand-onDark">
            You are about to publish a public claim.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-admin-text">
            Once saved,{" "}
            <span className="font-semibold text-admin-text">
              {preview} {label.trim() || "…"}
            </span>{" "}
            appears on the homepage and on the sponsors page, where prospective sponsors read
            it as a statement of reach. It should be a number someone has actually checked
            against YouTube, Facebook or the show&apos;s own records — not a figure carried
            over from the old site or a proposal.
          </p>
          <label className="mt-4 flex items-start gap-3 text-sm text-admin-text">
            <input
              type="checkbox"
              name="confirmVerified"
              required
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              I have checked this figure at source and confirm it is accurate and current.
            </span>
          </label>
          <p className="help">
            Your name and the time are recorded against this change.
          </p>
        </div>
      )}

      {comingDown && (
        <div className="border border-admin-line-strong bg-admin-raised p-5 sm:col-span-2">
          <p className="text-sm leading-relaxed text-admin-text">
            Saving now <span className="font-semibold text-admin-text">removes this figure</span>{" "}
            from the homepage and the sponsors page. The number stays here so it can be
            re-published once it has been confirmed.
          </p>
        </div>
      )}
    </CrudForm>
  );
}

/* ------------------------------------------------------------- take it down */

/**
 * Deliberately asymmetric with publishing. Putting a claim up needs a
 * confirmation; taking one down is the safe direction and is one click, because
 * the moment someone doubts a public number the fastest possible removal is the
 * correct behaviour.
 */
export function TakeDownButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        title={`Remove "${label}" from the public site`}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await unverifyStat(id);
            if (!res.ok) setError(res.error);
            else router.refresh();
          });
        }}
        className="text-xs font-semibold uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark disabled:opacity-50"
      >
        {pending ? "Removing…" : "Take down"}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
