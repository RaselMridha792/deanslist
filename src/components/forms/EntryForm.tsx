"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TALENT_CATEGORIES } from "@/content/site";

type Status = "idle" | "loading" | "error";

/**
 * The primary conversion on the site.
 *
 * Everything here lands in the client's own database through /api/leads. The old
 * site hands this job to a third-party MachForm iframe on ggnform.com, which is
 * why the business does not hold a single one of its own contestant records —
 * the whole reason for the rebuild.
 *
 * Kept to one screen rather than a wizard: this audience arrives from Facebook
 * and YouTube on a phone, and every extra step is somewhere to drop out.
 */
export function EntryForm({ showSlug, showTitle }: { showSlug?: string; showTitle?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CONTESTANT",
          firstName: String(fd.get("firstName") ?? ""),
          lastName: String(fd.get("lastName") ?? ""),
          email: String(fd.get("email") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          country: String(fd.get("country") ?? ""),
          stageName: String(fd.get("stageName") ?? ""),
          talentCategory: String(fd.get("talentCategory") ?? ""),
          ageRange: String(fd.get("ageRange") ?? ""),
          performanceUrl: String(fd.get("performanceUrl") ?? ""),
          message: String(fd.get("message") ?? ""),
          marketingOptIn: fd.get("marketingOptIn") === "on",
          website: String(fd.get("website") ?? ""),
          showSlug,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      router.push("/thank-you?from=contestant");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 sm:grid-cols-2" noValidate>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      {showTitle && (
        <p className="sm:col-span-2 -mb-1 text-sm text-chalk-faint">
          Entering <span className="text-brand">{showTitle}</span>
        </p>
      )}

      <Fieldset legend="About you">
        <Field label="First name" name="firstName" required autoComplete="given-name" />
        <Field label="Last name" name="lastName" autoComplete="family-name" />
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field label="Phone / WhatsApp" name="phone" type="tel" autoComplete="tel" />
        <Field label="Country" name="country" autoComplete="country-name" />
        <div>
          <label className="label" htmlFor="ef-ageRange">Age group</label>
          <select id="ef-ageRange" name="ageRange" className="field">
            <option value="">Prefer not to say</option>
            <option>Under 18</option>
            <option>18–24</option>
            <option>25–34</option>
            <option>35–44</option>
            <option>45+</option>
          </select>
          {/* Age matters for eligibility and guardian consent; the rules will
              set the policy. See /rules. */}
        </div>
      </Fieldset>

      <Fieldset legend="Your act">
        <Field label="Stage name" name="stageName" />
        <div>
          <label className="label" htmlFor="ef-talentCategory">
            Talent category <span className="text-brand">*</span>
          </label>
          <select id="ef-talentCategory" name="talentCategory" required className="field">
            <option value="">Select one</option>
            {TALENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="ef-performanceUrl">
            Performance video link <span className="text-brand">*</span>
          </label>
          <input
            id="ef-performanceUrl"
            name="performanceUrl"
            type="url"
            required
            inputMode="url"
            placeholder="https://youtube.com/watch?v=…"
            className="field"
          />
          <p className="help">
            A YouTube, Facebook, Instagram, TikTok or Google Drive link is fine. Make sure it
            is public or shared, or the judges cannot open it.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="ef-message">Anything else we should know?</label>
          <textarea id="ef-message" name="message" rows={4} className="field resize-y" />
        </div>
      </Fieldset>

      <label className="flex items-start gap-3 text-sm text-chalk-muted sm:col-span-2">
        <input type="checkbox" name="marketingOptIn" className="mt-1 h-4 w-4 accent-brand" />
        <span>
          Email me show announcements, reminders and results. You can unsubscribe in one
          click, any time.
        </span>
      </label>

      {error && (
        <p className="error-text sm:col-span-2" role="alert">
          {error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={status === "loading"}
          className="btn-primary w-full disabled:opacity-50 sm:w-auto"
        >
          {status === "loading" ? "Submitting…" : "Submit my entry"}
        </button>
        <p className="help">
          By entering you agree to the contest rules. We never share your details.
        </p>
      </div>
    </form>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="eyebrow mb-5">{legend}</legend>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = `ef-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label} {required && <span className="text-brand">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="field"
      />
    </div>
  );
}
