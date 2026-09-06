"use client";

import { useState } from "react";
import { Button } from "@/components/dl/Button";
import { readAttribution } from "@/lib/attribution";

type Status = "idle" | "loading" | "error" | "success";

/**
 * Two underlined fields on the red field. A boxed input here would read as a
 * hole punched in the poster, so the rule under the field is the whole control.
 *
 * On success the button becomes the confirmation, per the design, and the
 * fields lock. The state is also announced to assistive technology, because a
 * changed button label is a visual event and nothing else.
 */
export function NewsletterPosterForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const done = status === "success";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading" || done) return;
    setStatus("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...readAttribution(),
          firstName: String(fd.get("firstName") || "Friend"),
          email: String(fd.get("email") ?? "").trim(),
          // Honeypot. The route answers 200 and writes nothing when it is filled.
          website: String(fd.get("website") ?? ""),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col border-t-2 border-white">
      <p className="mb-8 mt-6 text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] opacity-90">
        Entry deadlines, live show reminders and winner announcements, in your inbox before they go
        out anywhere else.
      </p>

      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <label className="block border-b-2 border-white py-[14px]">
        <span className="label-dark text-white/90">First name</span>
        <input
          name="firstName"
          required
          disabled={done}
          autoComplete="given-name"
          placeholder="Your name"
          className="w-full border-0 bg-transparent p-0 text-[20px] font-semibold text-white outline-none placeholder:text-white/60 disabled:opacity-70"
        />
      </label>

      <label className="block border-b-2 border-white py-[14px]">
        <span className="label-dark text-white/90">Email address</span>
        <input
          name="email"
          type="email"
          required
          disabled={done}
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full border-0 bg-transparent p-0 text-[20px] font-semibold text-white outline-none placeholder:text-white/60 disabled:opacity-70"
        />
      </label>

      {error && (
        <p className="mt-4 text-[13px] font-semibold text-white" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={status === "loading" || done}
        className="mt-7 w-full border-ink bg-ink py-[18px] text-white hover:border-neutral-900 hover:bg-neutral-900 disabled:opacity-100"
      >
        {done ? "You're on the list" : status === "loading" ? "Sending" : "Notify me"}
      </Button>

      <p role="status" className="sr-only">
        {done ? "You are on the list." : ""}
      </p>

      <p className="mt-[14px] text-[12px] opacity-90">
        Show dates, entry deadlines and results. No spam, unsubscribe in one click.
      </p>
    </form>
  );
}
