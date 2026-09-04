"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

/**
 * The single highest-value form on the site.
 *
 * The business problem behind this whole rebuild is that a large social audience
 * is rented, not owned — every subscriber captured here is one the client can
 * reach without an algorithm's permission. So it appears on the homepage, the
 * thank-you page, and the watch page, and it asks for as little as possible.
 */
export function NewsletterForm({ source = "homepage" }: { source?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(fd.get("firstName") || "Friend"),
          email: String(fd.get("email") ?? ""),
          website: String(fd.get("website") ?? ""),
          source,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="rounded-card border border-gold/40 bg-gold/5 px-6 py-5 text-sm text-chalk-body">
        You&apos;re on the list. Show announcements and reminders will land in your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* Honeypot. Bots fill it, people never see it. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor={`nl-name-${source}`}>
          First name
        </label>
        <input
          id={`nl-name-${source}`}
          name="firstName"
          placeholder="First name"
          autoComplete="given-name"
          className="field sm:max-w-[11rem]"
        />

        <label className="sr-only" htmlFor={`nl-email-${source}`}>
          Email address
        </label>
        <input
          id={`nl-email-${source}`}
          name="email"
          type="email"
          required
          placeholder="you@email.com"
          autoComplete="email"
          aria-invalid={status === "error" || undefined}
          className={`field flex-1 ${status === "error" ? "field-error" : ""}`}
        />

        <button
          type="submit"
          disabled={status === "loading"}
          className="btn-primary shrink-0 disabled:opacity-50"
        >
          {status === "loading" ? "Joining…" : "Notify me"}
        </button>
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <p className="help">
        Show dates, entry deadlines and results. No spam, unsubscribe in one click.
      </p>
    </form>
  );
}
