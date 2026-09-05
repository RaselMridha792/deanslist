"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/dl/Button";
import { SuccessPanel } from "@/components/dl/SuccessPanel";

export type LeadFormField =
  | "fullName"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "country"
  | "location"
  | "address"
  | "company"
  | "role"
  | "link"
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
  /** The design marks some message fields required ("Why you") and some not. */
  messageRequired?: boolean;
  /** Options for the inquiryType select, when that field is present. */
  inquiryOptions?: readonly { value: string; label: string }[];
  roleOptions?: readonly string[];
  talentOptions?: readonly { value: string; label: string }[];
  consentLabel?: string;
  /**
   * Success copy. When a title is given, the form is replaced in place by the
   * grey panel with the 4px red left rule that every design file draws. Without
   * it the form keeps redirecting to /thank-you, which is the right landing for
   * the flows that have bespoke copy waiting there.
   */
  successTitle?: string;
  successBody?: string;
};

type Status = "idle" | "loading" | "error" | "success";

/**
 * One form behind /join and /sponsors. Both are lead capture with a different
 * `type` and a different field set, so two near-identical components would be
 * two places for a validation bug to hide.
 *
 * Everything lands in the client's own database via /api/leads, which is the
 * entire point of the rebuild. The old site posts to a third-party MachForm on
 * ggnform.com, so the client does not hold its own entries.
 */
export function LeadForm({
  type,
  fields,
  submitLabel,
  messageLabel = "Message",
  messagePlaceholder,
  messageRequired = false,
  inquiryOptions,
  roleOptions,
  talentOptions,
  consentLabel = "Email me show announcements and updates. Unsubscribe any time.",
  successTitle,
  successBody,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * Element ids have to be unique per INSTANCE, not per component.
   *
   * /join renders this form twice, the talent pool and the crew application, so
   * a hardcoded `lf-firstName` shipped that id twice on one page. Duplicate ids
   * are invalid HTML, and the visible symptom is worse than that: clicking the
   * crew form's name label moved focus into the talent pool input further up the
   * page, because a label resolves to the FIRST matching id in the document.
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
  // The schema needs a firstName on every lead, so a form asking for neither
  // name field still renders the split first/last pair rather than nothing.
  const wantsFullName = has("fullName");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;

    /**
     * Validate before the fetch, the way the /enter funnel validates each step.
     *
     * Every `required` on this form was decorative until this ran: the handler
     * calls preventDefault(), so the browser's own submit-time check never
     * fires, and an empty form used to POST. checkValidity() asks the question
     * the browser would have asked, and reportValidity() surfaces the browser's
     * own message and moves focus to the first field that failed. No bespoke
     * error strings, no second validation rulebook to keep in sync with zod.
     */
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setStatus("loading");
    setError(null);

    const fd = new FormData(form);

    /**
     * "Full name" is one input in the design and two columns in the schema, so
     * the first whitespace-separated token is the first name and the remainder
     * is the surname. Someone who gives one name keeps it: lastName is optional.
     */
    const name = wantsFullName
      ? splitName(String(fd.get("fullName") ?? ""))
      : {
          firstName: String(fd.get("firstName") ?? ""),
          lastName: String(fd.get("lastName") ?? ""),
        };

    /**
     * "Location" is likewise one input asking for "City, country". Splitting on
     * the LAST comma keeps the dashboard's country filter and its country index
     * working, instead of burying "Cardiff, Wales" in a single column.
     */
    const place = has("location")
      ? splitLocation(String(fd.get("location") ?? ""))
      : {
          city: String(fd.get("city") ?? ""),
          country: String(fd.get("country") ?? ""),
        };

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
          firstName: name.firstName,
          lastName: name.lastName,
          email: String(fd.get("email") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          country: place.country,
          addressLine1: String(fd.get("addressLine1") ?? ""),
          addressLine2: String(fd.get("addressLine2") ?? ""),
          city: place.city,
          state: String(fd.get("state") ?? ""),
          postalCode: String(fd.get("postalCode") ?? ""),
          talentCategory: String(fd.get("talentCategory") ?? ""),
          // The only URL column on Lead. A portfolio reel is the same kind of
          // thing the admin's player and the CSV export already handle.
          performanceUrl: has("link") ? String(fd.get("link") ?? "").trim() : "",
          message,
          marketingOptIn: fd.get("marketingOptIn") === "on",
          website: String(fd.get("website") ?? ""),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");

      if (successTitle) {
        setStatus("success");
        return;
      }
      router.push(`/thank-you?from=${type.toLowerCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success" && successTitle) {
    return <SuccessPanel title={successTitle}>{successBody}</SuccessPanel>;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      {/* Bots fill this, people never see it. The route answers 200 and writes
          nothing when it arrives filled. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      {wantsFullName ? (
        <div>
          <label className="label" htmlFor={fieldId("fullName")}>
            Full name <Req />
          </label>
          <input
            id={fieldId("fullName")}
            name="fullName"
            required
            autoComplete="name"
            placeholder="Your name"
            className="field"
          />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor={fieldId("firstName")}>
            First name <Req />
          </label>
          <input
            id={fieldId("firstName")}
            name="firstName"
            required
            autoComplete="given-name"
            className="field"
          />
        </div>
      )}

      {has("lastName") && (
        <div>
          <label className="label" htmlFor={fieldId("lastName")}>
            Last name
          </label>
          <input
            id={fieldId("lastName")}
            name="lastName"
            autoComplete="family-name"
            className="field"
          />
        </div>
      )}

      <div>
        <label className="label" htmlFor={fieldId("email")}>
          Email <Req />
        </label>
        <input
          id={fieldId("email")}
          name="email"
          type="email"
          required
          autoComplete="email"
          className="field"
        />
      </div>

      {has("phone") && (
        <div>
          <label className="label" htmlFor={fieldId("phone")}>
            Phone / WhatsApp
          </label>
          <input id={fieldId("phone")} name="phone" type="tel" autoComplete="tel" className="field" />
        </div>
      )}

      {has("country") && (
        <div>
          <label className="label" htmlFor={fieldId("country")}>
            Country
          </label>
          <input
            id={fieldId("country")}
            name="country"
            autoComplete="country-name"
            className="field"
          />
        </div>
      )}

      {has("company") && (
        <div>
          <label className="label" htmlFor={fieldId("company")}>
            Company / brand
          </label>
          <input
            id={fieldId("company")}
            name="company"
            autoComplete="organization"
            className="field"
          />
        </div>
      )}

      {has("role") && roleOptions && (
        <div>
          <label className="label" htmlFor={fieldId("role")}>
            Role <Req />
          </label>
          <select id={fieldId("role")} name="role" required defaultValue="" className="field">
            <option value="">Select one</option>
            {roleOptions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {has("location") && (
        <div>
          <label className="label" htmlFor={fieldId("location")}>
            Location <Req />
          </label>
          <input
            id={fieldId("location")}
            name="location"
            required
            autoComplete="address-level2"
            placeholder="City, country"
            className="field"
          />
        </div>
      )}

      {has("talentCategory") && talentOptions && (
        <div>
          <label className="label" htmlFor={fieldId("talentCategory")}>
            What do you do? <Req />
          </label>
          <select
            id={fieldId("talentCategory")}
            name="talentCategory"
            required
            defaultValue=""
            className="field"
          >
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
          <label className="label" htmlFor={fieldId("inquiryType")}>
            What is this about?
          </label>
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
            <label className="label" htmlFor={fieldId("city")}>
              City
            </label>
            <input
              id={fieldId("city")}
              name="city"
              autoComplete="address-level2"
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor={fieldId("state")}>
              State / region
            </label>
            <input
              id={fieldId("state")}
              name="state"
              autoComplete="address-level1"
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor={fieldId("postalCode")}>
              Postcode
            </label>
            <input
              id={fieldId("postalCode")}
              name="postalCode"
              autoComplete="postal-code"
              className="field"
            />
          </div>
        </>
      )}

      {has("link") && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor={fieldId("link")}>
            Portfolio or social link
          </label>
          {/* type=url so a half-typed address is caught by the browser, in the
              browser's own words, before zod sees it. */}
          <input
            id={fieldId("link")}
            name="link"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="Website, reel, or profile"
            className="field"
          />
        </div>
      )}

      {has("message") && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor={fieldId("message")}>
            {messageLabel} {messageRequired && <Req />}
          </label>
          <textarea
            id={fieldId("message")}
            name="message"
            rows={5}
            required={messageRequired}
            placeholder={messagePlaceholder}
            className="field resize-y"
          />
        </div>
      )}

      <label className="flex items-start gap-3 text-sm text-chalk-muted sm:col-span-2">
        <input type="checkbox" name="marketingOptIn" className="mt-1 h-4 w-4 accent-brand" />
        <span>{consentLabel}</span>
      </label>

      {error && (
        <p className="error-text sm:col-span-2" role="alert">
          {error}
        </p>
      )}

      <div className="sm:col-span-2">
        <Button
          type="submit"
          size="lg"
          disabled={status === "loading"}
          className="w-full disabled:opacity-50"
        >
          {status === "loading" ? "Sending" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** The site's required marker. The `required` attribute carries it for AT. */
function Req() {
  return (
    <span aria-hidden="true" className="text-brand">
      *
    </span>
  );
}

/** "Ada Lovelace King" becomes { firstName: "Ada", lastName: "Lovelace King" }. */
function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() ?? "", lastName: parts.join(" ") };
}

/** "Cardiff, Wales" becomes { city: "Cardiff", country: "Wales" }. */
function splitLocation(value: string) {
  const raw = value.trim();
  const cut = raw.lastIndexOf(",");
  if (cut === -1) return { city: raw, country: "" };
  return { city: raw.slice(0, cut).trim(), country: raw.slice(cut + 1).trim() };
}
