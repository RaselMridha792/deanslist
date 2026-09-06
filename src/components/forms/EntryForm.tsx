"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/dl/Button";
import { TALENT_CATEGORIES } from "@/content/site";
import { cn } from "@/lib/cn";
import { readAttribution } from "@/lib/attribution";

export type EntryShowOption = { slug: string; label: string };

type Props = {
  /** Built from the Shows manager, so a new show appears here without a deploy. */
  shows: EntryShowOption[];
  /** Preselected from /enter?show=slug, or the currently open show. */
  defaultShowSlug?: string;
};

const STEPS = ["Contact", "Talent", "Video", "Consent"] as const;

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  talentCategory: string;
  showSlug: string;
  stageName: string;
  performanceUrl: string;
  message: string;
};

const EMPTY: Values = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
  talentCategory: "",
  showSlug: "",
  stageName: "",
  performanceUrl: "",
  message: "",
};

/**
 * The four-step entry funnel. The highest-value thing on the site.
 *
 * Everything lands in the client's own database through /api/leads. The old site
 * hands this job to a third-party MachForm iframe on ggnform.com, which is why
 * the business does not hold a single one of its own contestant records.
 *
 * Two decisions worth stating:
 *
 *   State, not hidden inputs. Only the active step is in the DOM, so field
 *   values live in React rather than in unmounted inputs. Keeping every step
 *   mounted and hidden would be simpler until the final submit, where the
 *   browser refuses to focus an invalid control it cannot show and the form
 *   silently does nothing.
 *
 *   Native validation, per the handoff. "Continue" runs checkValidity() on the
 *   fields that are actually visible and reportValidity() on the first failure,
 *   so the browser's own message and focus behaviour do the work. The final
 *   step submits normally, which validates the consent boxes for free.
 */
export function EntryForm({ shows, defaultShowSlug }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moveFocus = useRef(false);

  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>({
    ...EMPTY,
    showSlug: defaultShowSlug ?? "",
  });
  const [consent, setConsent] = useState({ rules: false, broadcast: false, marketing: true });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Focus the new step's heading, but only when the visitor moved between steps
  // — never on first paint, which would yank the page down to the form.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    headingRef.current?.focus();
  }, [step]);

  const set =
    (key: keyof Values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  function goNext() {
    const form = formRef.current;
    if (form) {
      const fields = Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          "input, select, textarea",
        ),
      );
      // offsetParent is null for anything not rendered, so this only ever
      // validates what the visitor can actually see and fix.
      const bad = fields.find((f) => f.offsetParent !== null && !f.checkValidity());
      if (bad) {
        bad.reportValidity();
        return;
      }
    }
    moveFocus.current = true;
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  function goBack() {
    moveFocus.current = true;
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const honeypot = String(new FormData(e.currentTarget).get("website") ?? "");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...readAttribution(),
          type: "CONTESTANT",
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          country: values.country,
          stageName: values.stageName,
          talentCategory: values.talentCategory,
          performanceUrl: values.performanceUrl,
          message: values.message,
          marketingOptIn: consent.marketing,
          // Both are required to reach this point in the funnel. Sending them
          // is what turns a checkbox into a record.
          rulesAccepted: consent.rules,
          broadcastConsent: consent.broadcast,
          website: honeypot,
          showSlug: values.showSlug || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      router.push("/thank-you?from=contestant");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="border-t-[6px] border-brand bg-ground pt-6"
    >
      {/* Honeypot. A filled value is answered 200 and written nowhere. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <ol className="mb-7 grid grid-cols-4 border-b-2 border-rule">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const past = step > n;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-[10px] overflow-hidden whitespace-nowrap py-3",
                "pr-[clamp(8px,1vw,16px)] text-[11px] font-semibold uppercase tracking-[.12em]",
                i > 0 && "pl-[clamp(8px,1vw,16px)]",
                active || past ? "text-ink" : "text-neutral-500",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid h-[22px] w-[22px] shrink-0 place-items-center text-[11px]",
                  active ? "bg-brand text-ground" : past ? "bg-ink text-ground" : "bg-neutral-300 text-neutral-700",
                )}
              >
                {n}
              </span>
              <span className="overflow-hidden text-ellipsis">
                <span className="sr-only">{`Step ${n} of ${STEPS.length}: `}</span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <StepHeading innerRef={headingRef}>Who is entering?</StepHeading>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="firstName"
              label="First name"
              placeholder="Your first name"
              autoComplete="given-name"
              required
              value={values.firstName}
              onChange={set("firstName")}
            />
            <TextField
              name="lastName"
              label="Last name"
              placeholder="Your last name"
              autoComplete="family-name"
              required
              value={values.lastName}
              onChange={set("lastName")}
            />
          </div>

          <TextField
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            value={values.email}
            onChange={set("email")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="phone"
              label="Phone (optional)"
              type="tel"
              inputMode="tel"
              placeholder="+1"
              autoComplete="tel"
              value={values.phone}
              onChange={set("phone")}
            />
            <TextField
              name="country"
              label="Country"
              placeholder="Where you perform from"
              autoComplete="country-name"
              required
              value={values.country}
              onChange={set("country")}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <StepHeading innerRef={headingRef}>What do you do?</StepHeading>

          <div>
            <label className="label" htmlFor="entry-talentCategory">
              Talent category
            </label>
            <select
              id="entry-talentCategory"
              name="talentCategory"
              required
              value={values.talentCategory}
              onChange={set("talentCategory")}
              className="field min-h-[48px]"
            >
              <option value="">Select one</option>
              {TALENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="entry-showSlug">
              Show you are entering
            </label>
            <select
              id="entry-showSlug"
              name="showSlug"
              required
              value={values.showSlug}
              onChange={set("showSlug")}
              className="field min-h-[48px]"
            >
              <option value="">Select one</option>
              {shows.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <TextField
            name="stageName"
            label="Stage name (optional)"
            placeholder="How you want to be announced"
            value={values.stageName}
            onChange={set("stageName")}
          />
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <StepHeading innerRef={headingRef}>Show us the performance.</StepHeading>

          <TextField
            name="performanceUrl"
            label="Performance video link"
            type="url"
            inputMode="url"
            placeholder="YouTube, Facebook, Instagram or Drive link"
            required
            value={values.performanceUrl}
            onChange={set("performanceUrl")}
          />

          <p className="text-[13px] leading-relaxed text-neutral-700">
            Make sure the link is public or the judges cannot open it.
          </p>

          {/*
            The upload alternative is drawn because the design specifies it, and
            disabled because nothing is wired to receive a 500 MB file yet. A
            control that accepts a video and drops it on the floor is worse than
            no control at all.
          */}
          <div
            aria-hidden
            className="flex items-center justify-between gap-4 border-2 border-dashed border-rule p-5 text-[14px] text-neutral-600 opacity-60"
          >
            <span>Drop a video file here (MP4 or MOV, up to 500 MB)</span>
            <input type="file" name="file" accept="video/*" disabled className="text-[13px]" />
          </div>
          <p className="text-[13px] leading-relaxed text-neutral-700">
            Direct upload is not switched on yet. Paste a link above and the judges will watch it
            there.
          </p>

          <div>
            <label className="label" htmlFor="entry-message">
              Anything the judges should know (optional)
            </label>
            <textarea
              id="entry-message"
              name="message"
              rows={4}
              placeholder="Song, instrument, story behind the performance"
              value={values.message}
              onChange={set("message")}
              className="field min-h-[90px] resize-y"
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <StepHeading innerRef={headingRef}>Last step.</StepHeading>

          <Consent
            name="ageAndRules"
            required
            checked={consent.rules}
            onChange={(v) => setConsent((c) => ({ ...c, rules: v }))}
          >
            {"I am 18 or older, or entering with a guardian's consent, and I have read the "}
            {/* A click on interactive content inside a label does not toggle
                the control, per the HTML activation-behaviour rules, so this
                link reads as a link rather than as a second checkbox. */}
            <Link href="/rules" className="text-brand-onLight underline underline-offset-4">
              rules and eligibility
            </Link>
            .
          </Consent>

          <Consent
            name="broadcastConsent"
            required
            checked={consent.broadcast}
            onChange={(v) => setConsent((c) => ({ ...c, broadcast: v }))}
          >
            {"Dean's List LTD may broadcast my performance across its channels."}
          </Consent>

          <Consent
            name="marketingOptIn"
            checked={consent.marketing}
            onChange={(v) => setConsent((c) => ({ ...c, marketing: v }))}
          >
            Email me show announcements and reminders. One click to unsubscribe.
          </Consent>
        </div>
      )}

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-3 border-t-2 border-rule pt-5">
        {step > 1 && (
          <Button type="button" variant="outline" size="lg" onClick={goBack}>
            Back
          </Button>
        )}

        {step < STEPS.length ? (
          <Button type="button" size="lg" onClick={goNext} className="ml-auto min-w-[200px]">
            Continue
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            disabled={status === "loading"}
            className="ml-auto min-w-[200px] disabled:opacity-60"
          >
            {status === "loading" ? "Submitting" : "Submit my entry"}
          </Button>
        )}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ parts */

function StepHeading({
  innerRef,
  children,
}: {
  innerRef: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
}) {
  return (
    <h2
      ref={innerRef}
      tabIndex={-1}
      className="mb-2 text-[clamp(24px,2vw,32px)] font-extrabold leading-none tracking-[-.03em] outline-none"
    >
      {children}
    </h2>
  );
}

function TextField({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
  autoComplete,
  inputMode,
  value,
  onChange,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "url";
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = `entry-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        className="field min-h-[48px]"
      />
    </div>
  );
}

function Consent({
  name,
  required = false,
  checked,
  onChange,
  children,
}: {
  name: string;
  required?: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1 text-[14px] leading-[1.5]">
      <input
        type="checkbox"
        name={name}
        required={required}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] h-4 w-4 shrink-0 accent-brand"
      />
      <span>{children}</span>
    </label>
  );
}
