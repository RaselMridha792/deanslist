"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export function EntryForm({ showSlug }: { showSlug?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      type: "CONTESTANT" as const,
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      country: String(fd.get("country") ?? ""),
      stageName: String(fd.get("stageName") ?? ""),
      talentCategory: String(fd.get("talentCategory") ?? ""),
      performanceUrl: String(fd.get("performanceUrl") ?? ""),
      message: String(fd.get("message") ?? ""),
      marketingOptIn: fd.get("marketingOptIn") === "on",
      website: String(fd.get("website") ?? ""),
      showSlug,
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-gold/40 bg-gold/5 p-8 text-center">
        <p className="font-display text-2xl tracking-wide text-gold">Entry received</p>
        <p className="mt-2 text-sm text-white/70">
          Check your inbox for a confirmation. If you are selected, our team will reach out.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />

      <div>
        <label className="label" htmlFor="firstName">First name *</label>
        <input id="firstName" name="firstName" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="lastName">Last name</label>
        <input id="lastName" name="lastName" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email *</label>
        <input id="email" name="email" type="email" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone / WhatsApp</label>
        <input id="phone" name="phone" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="country">Country</label>
        <input id="country" name="country" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="stageName">Stage name</label>
        <input id="stageName" name="stageName" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="talentCategory">Talent category</label>
        <select id="talentCategory" name="talentCategory" className="field">
          <option value="">Select one</option>
          <option>Singing</option>
          <option>Rap</option>
          <option>Instrument</option>
          <option>Dance</option>
          <option>Comedy</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="performanceUrl">Performance video link</label>
        <input id="performanceUrl" name="performanceUrl" placeholder="https://" className="field" />
      </div>

      <div className="md:col-span-2">
        <label className="label" htmlFor="message">Tell us about yourself</label>
        <textarea id="message" name="message" rows={4} className="field" />
      </div>

      <label className="flex items-start gap-3 text-sm text-white/60 md:col-span-2">
        <input type="checkbox" name="marketingOptIn" className="mt-1 accent-[#D4AF37]" />
        <span>
          Send me show announcements, reminders, and results by email. You can unsubscribe
          at any time.
        </span>
      </label>

      {error && <p className="text-sm text-red-400 md:col-span-2">{error}</p>}

      <div className="md:col-span-2">
        <button type="submit" disabled={status === "loading"} className="btn-primary disabled:opacity-50">
          {status === "loading" ? "Submitting..." : "Submit my entry"}
        </button>
      </div>
    </form>
  );
}
