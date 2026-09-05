"use client";

import { useState } from "react";
import Link from "next/link";
import { TALENT_CATEGORIES } from "@/content/site";

type Status = "idle" | "loading" | "success" | "error";

/**
 * The compact entry. Same destination as /enter — POST /api/leads, which stores
 * the row with source WEBSITE_FORM by default — but cut to the four fields that
 * make an entry actionable, because this form is competing with the video the
 * visitor came to watch.
 *
 * The performance link is optional here on purpose. Someone reading on a phone
 * rarely has the URL to hand, and a captured contestant the team can email is
 * worth far more than a form they abandoned at the one field they could not
 * fill. The absence is recorded on the lead so the team knows to chase it.
 */
export function EntryTab({
  showSlug,
  onAskInstead,
}: {
  showSlug?: string;
  onAskInstead?: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);
    const performanceUrl = String(fd.get("performanceUrl") ?? "").trim();

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CONTESTANT",
          firstName: String(fd.get("firstName") ?? "").trim(),
          email: String(fd.get("email") ?? "").trim(),
          country: String(fd.get("country") ?? "").trim(),
          talentCategory: String(fd.get("talentCategory") ?? ""),
          performanceUrl,
          message: performanceUrl
            ? "Submitted from the site widget."
            : "Submitted from the site widget. No performance link yet — needs chasing.",
          marketingOptIn: fd.get("marketingOptIn") === "on",
          website: String(fd.get("website") ?? ""),
          showSlug,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="border border-brand/40 bg-brand/5 p-5">
        <p className="eyebrow">Entry received</p>
        <p className="mt-3 text-sm text-ink">
          The team reviews every submission and replies by email. Nothing else is needed from
          you right now.
        </p>
        <Link href="/enter" className="btn-quiet mt-5">
          Add more detail</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div>
        <p className="eyebrow">Enter the contest</p>
        <p className="mt-2 text-sm text-neutral-700">
          Four fields. You can send your performance link later.
        </p>
      </div>

      {/* Honeypot. Bots fill it, people never see it. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <div>
        <label className="label" htmlFor="cw-firstName">
          First name <span className="text-brand">*</span>
        </label>
        <input
          id="cw-firstName"
          name="firstName"
          required
          autoComplete="given-name"
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="cw-email">
          Email <span className="text-brand">*</span>
        </label>
        <input
          id="cw-email"
          name="email"
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="cw-talentCategory">
          Talent <span className="text-brand">*</span>
        </label>
        <select id="cw-talentCategory" name="talentCategory" required className="field">
          <option value="">Select one</option>
          {TALENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="cw-country">
          Country
        </label>
        <input id="cw-country" name="country" autoComplete="country-name" className="field" />
      </div>

      <div>
        <label className="label" htmlFor="cw-performanceUrl">
          Performance link
        </label>
        <input
          id="cw-performanceUrl"
          name="performanceUrl"
          type="url"
          inputMode="url"
          placeholder="https://youtube.com/watch?v=…"
          className="field"
        />
        <p className="help">Optional here. Make sure it is public or the judges cannot open it.</p>
      </div>

      <label className="flex items-start gap-3 text-sm text-neutral-700">
        <input type="checkbox" name="marketingOptIn" className="mt-1 h-4 w-4 accent-brand" />
        <span>Email me show announcements and reminders. One click to unsubscribe.</span>
      </label>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="btn btn-primary w-full disabled:opacity-50"
      >
        {status === "loading" ? "Sending…" : "Submit my entry"}
      </button>

      <div className="flex items-center justify-between gap-3 pt-1">
        {onAskInstead && (
          <button type="button" onClick={onAskInstead} className="btn-quiet !text-xs">
            Got a question first?
          </button>
        )}
        <Link href="/enter" className="text-xs uppercase tracking-widest text-neutral-600 hover:text-brand">
          Full form
        </Link>
      </div>
    </form>
  );
}
