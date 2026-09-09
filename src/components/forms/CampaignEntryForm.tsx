"use client";

import { useState } from "react";
import { readAttribution } from "@/lib/attribution";

/**
 * Enter a contest from its own campaign page.
 *
 * The shape is fixed and the variable parts are toggles set per campaign. That
 * is a deliberate limit: a producer wants a working sign-up form for the contest
 * they thought of this morning, not a field-type dropdown, and every form
 * builder ends up asking its user to be a developer for ten minutes.
 *
 * Name and email are always asked. A contest entry nobody can be contacted
 * about is not an entry — it is a number.
 *
 * The extras go into the message body rather than into columns of their own,
 * which is the same thing the contact and sponsor forms do. A column per
 * contest question would be a migration every time the client has an idea.
 */

export type EntryFormConfig = {
  promotionSlug: string;
  heading: string;
  blurb: string | null;
  buttonLabel: string;
  askPhone: boolean;
  askCity: boolean;
  askGroupSize: boolean;
  askLink: boolean;
  question: string | null;
};

type State =
  | { status: "idle" | "sending" | "done" }
  | { status: "error"; message: string };

export function CampaignEntryForm({ config }: { config: EntryFormConfig }) {
  const [state, setState] = useState<State>({ status: "idle" });

  if (state.status === "done") {
    return (
      <div className="border-l-4 border-brand bg-white p-7">
        <p className="kicker">You are in</p>
        <h3 className="mt-3 text-[clamp(22px,2.2vw,32px)] font-extrabold leading-[1.05] tracking-[-.03em] text-ink">
          We have your entry.
        </h3>
        <p className="mt-4 max-w-[46ch] text-pretty text-body text-neutral-700">
          The team reads every one. You will hear from us by email, and the
          result is announced on the show.
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

    // Everything the fixed columns cannot hold, written as a readable block so
    // the dashboard shows an answer rather than a JSON blob.
    const extras: string[] = [];
    const groupSize = String(fd.get("groupSize") ?? "").trim();
    const link = String(fd.get("link") ?? "").trim();
    const answer = String(fd.get("answer") ?? "").trim();
    if (groupSize) extras.push(`How many people: ${groupSize}`);
    if (link) extras.push(`Link: ${link}`);
    if (answer && config.question) extras.push(`${config.question}\n${answer}`);

    setState({ status: "sending" });

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...readAttribution(),
          type: "FAN",
          source: "WEBSITE_FORM",
          promotionSlug: config.promotionSlug,
          firstName: firstName || fullName,
          lastName: rest.join(" ") || undefined,
          email: String(fd.get("email") ?? "").trim(),
          phone: String(fd.get("phone") ?? "").trim() || undefined,
          city: String(fd.get("city") ?? "").trim() || undefined,
          message: extras.join("\n\n") || undefined,
          marketingOptIn: fd.get("marketingOptIn") === "on",
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
      <p className="kicker">Enter</p>
      <h3 className="mt-3 text-[clamp(22px,2.2vw,32px)] font-extrabold leading-[1.05] tracking-[-.03em] text-ink">
        {config.heading}
      </h3>
      {config.blurb && (
        <p className="mt-3 max-w-[48ch] text-pretty text-body text-neutral-700">
          {config.blurb}
        </p>
      )}

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
          <label className="label" htmlFor="ce-name">
            Your name
          </label>
          <input
            id="ce-name"
            name="fullName"
            required
            autoComplete="name"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="ce-email">
            Email
          </label>
          <input
            id="ce-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className="field"
          />
          <p className="help">This is how we tell you if you have won.</p>
        </div>

        {config.askPhone && (
          <div>
            <label className="label" htmlFor="ce-phone">
              Phone{" "}
              <span className="font-normal normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <input
              id="ce-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              className="field"
            />
          </div>
        )}

        {config.askCity && (
          <div>
            <label className="label" htmlFor="ce-city">
              Where are you?
            </label>
            <input
              id="ce-city"
              name="city"
              autoComplete="address-level2"
              placeholder="City, state or country"
              className="field"
            />
          </div>
        )}

        {config.askGroupSize && (
          <div>
            <label className="label" htmlFor="ce-group">
              How many people?
            </label>
            <input
              id="ce-group"
              name="groupSize"
              type="number"
              min={1}
              max={999}
              inputMode="numeric"
              className="field"
            />
          </div>
        )}

        {config.askLink && (
          <div>
            <label className="label" htmlFor="ce-link">
              Link{" "}
              <span className="font-normal normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <input
              id="ce-link"
              name="link"
              type="url"
              placeholder="https://"
              className="field"
            />
            <p className="help">
              A post, a video, anything you want us to see.
            </p>
          </div>
        )}

        {config.question && (
          <div>
            <label className="label" htmlFor="ce-answer">
              {config.question}
            </label>
            <textarea
              id="ce-answer"
              name="answer"
              rows={3}
              className="field resize-y"
            />
          </div>
        )}

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
          {sending ? "Sending" : config.buttonLabel}
        </button>

        <p className="text-[13px] leading-relaxed text-neutral-600">
          Free to enter. No payment is taken and no card details are asked for.
        </p>
      </div>
    </form>
  );
}
