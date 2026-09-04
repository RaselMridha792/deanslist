"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

export type LeadFormField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "country"
  | "address"
  | "company"
  | "role"
  | "inquiryType"
  | "talentCategory"
  | "message";

type Props = {
  /** Maps to LeadType in the schema, so the dashboard can route and filter. */
  type: "CREW" | "SPONSOR" | "GENERAL" | "PRESS" | "FAN";
  fields: LeadFormField[];
  submitLabel: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  /** Options for the inquiryType select, when that field is present. */
  inquiryOptions?: readonly { value: string; label: string }[];
  roleOptions?: readonly string[];
  talentOptions?: readonly { value: string; label: string }[];
  consentLabel?: string;
};

/**
 * One form behind /join, /sponsors and /contact. All three are lead capture with
 * a different `type` and a different field set, so three near-identical
 * components would be three places for a validation bug to hide.
 *
 * Everything lands in the client's own database via /api/leads — the entire
 * point of the rebuild. The old site posts to a third-party MachForm on
 * ggnform.com, so the client does not hold its own entries.
 */
export function LeadForm({
  type,
  fields,
  submitLabel,
  messageLabel = "Message",
  messagePlaceholder,
  inquiryOptions,
  roleOptions,
  talentOptions,
  consentLabel = "Email me show announcements and updates. Unsubscribe any time.",
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * Element ids have to be unique per INSTANCE, not per component.
   *
   * /join renders this form twice — the talent pool and the crew application —
   * so a hardcoded `lf-firstName` shipped that id twice on one page. Duplicate
   * ids are invalid HTML, and the visible symptom is worse than that: clicking
   * the crew form's "First name" label moved focus into the talent pool input
   * further up the page, because a label resolves to the FIRST matching id in
   * the document.
   *
   * useId() is stable across the server render and hydration, which a counter or
   * a random value would not be. The colons React wraps it in are legal in an
   * HTML id but need escaping in a CSS selector, so they are stripped; what is
   * left still differs between instances.
   */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Takes any name, not just LeadFormField: the address block renders five
  // sub-inputs that are one logical field but five ids.
  const fieldId = (name: string) => `lf-${uid}-${name}`;

  const has = (f: LeadFormField) => fields.includes(f);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);

    // company/role/inquiryType have no dedicated schema column; they ride in
    // `message` so nothing submitted is silently dropped.
    const extras = [
      has("company") && fd.get("company") ? `Company: ${fd.get("company")}` : null,
      has("role") && fd.get("role") ? `Role: ${fd.get("role")}` : null,
      has("inquiryType") && fd.get("inquiryType") ? `Enquiry: ${fd.get("inquiryType")}` : null,
    ].filter(Boolean);

    const body = String(fd.get("message") ?? "");
    const message = [...extras, body].filter(Boolean).join("\n");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          firstName: String(fd.get("firstName") ?? ""),
          lastName: String(fd.get("lastName") ?? ""),
          email: String(fd.get("email") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          country: String(fd.get("country") ?? ""),
          addressLine1: String(fd.get("addressLine1") ?? ""),
          addressLine2: String(fd.get("addressLine2") ?? ""),
          city: String(fd.get("city") ?? ""),
          state: String(fd.get("state") ?? ""),
          postalCode: String(fd.get("postalCode") ?? ""),
          talentCategory: String(fd.get("talentCategory") ?? ""),
          message,
          marketingOptIn: fd.get("marketingOptIn") === "on",
          website: String(fd.get("website") ?? ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      router.push(`/thank-you?from=${type.toLowerCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" noValidate>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <div>
        <label className="label" htmlFor={fieldId("firstName")}>
          First name <span className="text-gold">*</span>
        </label>
        <input id={fieldId("firstName")} name="firstName" required autoComplete="given-name" className="field" />
      </div>

      {has("lastName") && (
        <div>
          <label className="label" htmlFor={fieldId("lastName")}>Last name</label>
          <input id={fieldId("lastName")} name="lastName" autoComplete="family-name" className="field" />
        </div>
      )}

      <div>
        <label className="label" htmlFor={fieldId("email")}>
          Email <span className="text-gold">*</span>
        </label>
        <input id={fieldId("email")} name="email" type="email" required autoComplete="email" className="field" />
      </div>

      {has("phone") && (
        <div>
          <label className="label" htmlFor={fieldId("phone")}>Phone / WhatsApp</label>
          <input id={fieldId("phone")} name="phone" type="tel" autoComplete="tel" className="field" />
        </div>
      )}

      {has("country") && (
        <div>
          <label className="label" htmlFor={fieldId("country")}>Country</label>
          <input id={fieldId("country")} name="country" autoComplete="country-name" className="field" />
        </div>
      )}

      {has("company") && (
        <div>
          <label className="label" htmlFor={fieldId("company")}>Company / brand</label>
          <input id={fieldId("company")} name="company" autoComplete="organization" className="field" />
        </div>
      )}

      {has("role") && roleOptions && (
        <div>
          <label className="label" htmlFor={fieldId("role")}>What are you applying for?</label>
          <select id={fieldId("role")} name="role" className="field">
            <option value="">Select one</option>
            {roleOptions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {has("talentCategory") && talentOptions && (
        <div>
          <label className="label" htmlFor={fieldId("talentCategory")}>
            What do you do? <span className="text-gold">*</span>
          </label>
          <select id={fieldId("talentCategory")} name="talentCategory" required className="field">
            <option value="">Select one</option>
            {talentOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {has("inquiryType") && inquiryOptions && (
        <div>
          <label className="label" htmlFor={fieldId("inquiryType")}>What is this about?</label>
          <select id={fieldId("inquiryType")} name="inquiryType" className="field">
            {inquiryOptions.map((o) => (
              <option key={o.value} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {has("address") && (
        <>
          <div className="sm:col-span-2">
            <label className="label" htmlFor={fieldId("addressLine1")}>
              Address
            </label>
            <input
              id={fieldId("addressLine1")}
              name="addressLine1"
              autoComplete="address-line1"
              placeholder="Street address"
              className="field"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="sr-only" htmlFor={fieldId("addressLine2")}>
              Address line 2
            </label>
            <input
              id={fieldId("addressLine2")}
              name="addressLine2"
              autoComplete="address-line2"
              placeholder="Apartment, suite, etc. (optional)"
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor={fieldId("city")}>City</label>
            <input id={fieldId("city")} name="city" autoComplete="address-level2" className="field" />
          </div>
          <div>
            <label className="label" htmlFor={fieldId("state")}>State / region</label>
            <input id={fieldId("state")} name="state" autoComplete="address-level1" className="field" />
          </div>
          <div>
            <label className="label" htmlFor={fieldId("postalCode")}>Postcode</label>
            <input id={fieldId("postalCode")} name="postalCode" autoComplete="postal-code" className="field" />
          </div>
        </>
      )}

      {has("message") && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor={fieldId("message")}>{messageLabel}</label>
          <textarea
            id={fieldId("message")}
            name="message"
            rows={5}
            placeholder={messagePlaceholder}
            className="field resize-y"
          />
        </div>
      )}

      <label className="flex items-start gap-3 text-sm text-chalk-muted sm:col-span-2">
        <input type="checkbox" name="marketingOptIn" className="mt-1 h-4 w-4 accent-[#D4AF37]" />
        <span>{consentLabel}</span>
      </label>

      {error && (
        <p className="error-text sm:col-span-2" role="alert">
          {error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button type="submit" disabled={status === "loading"} className="btn-primary disabled:opacity-50">
          {status === "loading" ? "Sending…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
