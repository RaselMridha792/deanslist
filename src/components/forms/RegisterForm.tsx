"use client";

import { useState } from "react";
import { readAttribution } from "@/lib/attribution";
import { TALENT_CATEGORIES } from "@/content/site";

/**
 * The registration form for paid traffic.
 *
 * It is deliberately shorter than the one on /enter. Every field on a landing
 * page costs conversions, and a visitor arriving from an ad has spent no time
 * on this site and owes it no patience. So this asks for the five things the
 * client actually needs to contact someone and slot them into a show, and
 * everything else is collected later, by a human, from a person who has already
 * said yes.
 *
 * Two decisions worth knowing about.
 *
 * NAME IS ONE FIELD. Splitting it into first and last is a measurable drop in
 * completions and buys nothing: the split happens here on submit, and a
 * one-word name simply has no last name, which is correct rather than an error.
 *
 * ADDRESS IS ONE FIELD. The database has five (line 1, line 2, city, state,
 * postcode, country) and asking for five on an ad landing page would be the
 * single most expensive thing on the screen. It goes into line 1 as typed, and
 * the dashboard shows it as typed. A structured address is worth collecting
 * from a shortlisted performer, not from a stranger who clicked an ad.
 */

type State =
  | { status: "idle" | "sending" | "done" }
  | { status: "error"; message: string };

export function RegisterForm() {
  const [state, setState] = useState<State>({ status: "idle" });

  if (state.status === "done") {
    return (
      <div className="border-l-4 border-brand bg-white p-7">
        <p className="kicker">You are registered</p>
        <h2 className="mt-3 text-[clamp(24px,2.4vw,34px)] font-extrabold leading-[1.05] tracking-[-.03em] text-ink">
          We have your details.
        </h2>
        <p className="mt-4 max-w-[46ch] text-pretty text-body text-neutral-700">
          Someone from the team reads every registration. You will hear from us
          by email about the next show and what to send in. Nothing else is
          needed from you right now.
        </p>
        <p className="mt-4 text-[13px] text-neutral-600">
          Check your spam folder if you have not heard from us within a few
          days.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const fullName = String(fd.get("fullName") ?? "").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);

    setState({ status: "sending" });

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...readAttribution(),
          type: "CONTESTANT",
          source: "WEBSITE_FORM",
          firstName: firstName || fullName,
          lastName: rest.join(" ") || undefined,
          email: String(fd.get("email") ?? "").trim(),
          phone: String(fd.get("phone") ?? "").trim() || undefined,
          addressLine1: String(fd.get("address") ?? "").trim() || undefined,
          talentCategory: String(fd.get("talentCategory") ?? "") || undefined,
          marketingOptIn: fd.get("marketingOptIn") === "on",
          // One checkbox, two consents. They are bundled because neither is
          // optional for the thing being registered for: you cannot enter a
          // broadcast contest without accepting its rules or agreeing to be
          // broadcast. The marketing opt-in above stays separate, because that
          // one IS optional and bundling it would make it worthless.
          rulesAccepted: fd.get("consent") === "on",
          broadcastConsent: fd.get("consent") === "on",
          // Honeypot. The route answers 200 and writes nothing when it is
          // filled, so a bot records a success and stops trying.
          website: String(fd.get("website") ?? ""),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({
          status: "error",
          message:
            typeof body?.error === "string"
              ? body.error
              : "That did not go through. Please try again in a moment.",
        });
        return;
      }

      form.reset();
      setState({ status: "done" });
    } catch {
      setState({
        status: "error",
        message:
          "We could not reach the server. Check your connection and try again.",
      });
    }
  }

  const sending = state.status === "sending";

  return (
    <form
      onSubmit={onSubmit}
      className="border-2 border-ink bg-white p-6 sm:p-8"
    >
      <p className="kicker">Register to perform</p>
      <h2 className="mt-3 text-[clamp(22px,2.2vw,30px)] font-extrabold leading-[1.05] tracking-[-.03em] text-ink">
        Five fields. Under a minute.
      </h2>

      {/* Honeypot. Off-screen rather than display:none, which some bots skip. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <div className="mt-6 flex flex-col gap-5">
        <div>
          <label className="label" htmlFor="reg-name">
            Full name
          </label>
          <input
            id="reg-name"
            name="fullName"
            required
            autoComplete="name"
            placeholder="Your name"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="field"
          />
          <p className="help">This is how we tell you when you are on.</p>
        </div>

        <div>
          <label className="label" htmlFor="reg-phone">
            Phone{" "}
            <span className="font-normal normal-case tracking-normal">
              (optional)
            </span>
          </label>
          <input
            id="reg-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="Only if you would rather we call"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="reg-address">
            Address
          </label>
          <input
            id="reg-address"
            name="address"
            autoComplete="street-address"
            placeholder="Street, city, state or country"
            className="field"
          />
          <p className="help">Where to send the prize if you win.</p>
        </div>

        <div>
          <label className="label" htmlFor="reg-talent">
            What do you want to perform?
          </label>
          <select
            id="reg-talent"
            name="talentCategory"
            required
            className="field"
            defaultValue=""
          >
            <option value="" disabled>
              Choose your talent
            </option>
            {TALENT_CATEGORIES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-neutral-800">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-1 h-4 w-4 shrink-0 accent-brand"
          />
          <span>
            I am 18 or over, I accept the contest rules, and I agree that my
            performance may be broadcast on YouTube and Facebook.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-neutral-700">
          <input
            type="checkbox"
            name="marketingOptIn"
            defaultChecked
            className="mt-1 h-4 w-4 shrink-0 accent-brand"
          />
          <span>
            Email me when show dates and results are announced. One click to
            stop.
          </span>
        </label>

        {state.status === "error" && (
          <p className="error-text">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="btn btn-primary btn-lg disabled:opacity-60"
        >
          {sending ? "Sending" : "Register to perform"}
        </button>

        <p className="text-[13px] leading-relaxed text-neutral-600">
          No payment is taken and no card details are asked for, here or later.
        </p>
      </div>
    </form>
  );
}
