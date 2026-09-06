"use client";

import { useState } from "react";
import { Button } from "@/components/dl/Button";
import { SuccessPanel } from "@/components/dl/SuccessPanel";
import { TALENT_CATEGORIES } from "@/content/site";
import { readAttribution } from "@/lib/attribution";

type Status = "idle" | "loading" | "error" | "success";

/**
 * The card that makes the hero a conversion page rather than a poster.
 *
 * Four fields, because it is competing with a full-screen video for attention.
 * It posts to the same endpoint as /enter (POST /api/leads, type CONTESTANT) so
 * a hero entry and a funnel entry land in one table, and the team chases the
 * missing performance link by email rather than losing the lead at the one
 * field a phone visitor cannot fill.
 *
 * The design's shortlist of six talents is a subset of the eight on /enter. The
 * option VALUES come from TALENT_CATEGORIES so the dashboard's filters keep
 * matching; only the visible labels are the design's own wording.
 */
const HERO_TALENT_LABELS: Record<string, string> = {
  Singer: "Singer",
  "Song Writer": "Songwriter",
  Musician: "Musician",
  DJ: "DJ",
  Rapper: "Rapper",
  Other: "Something else",
};

const HERO_TALENTS = TALENT_CATEGORIES.filter((t) => t.value in HERO_TALENT_LABELS).map((t) => ({
  value: t.value,
  label: HERO_TALENT_LABELS[t.value] as string,
}));

export function HeroEntryForm({
  showSlug,
  statusLabel,
}: {
  showSlug?: string;
  statusLabel: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...readAttribution(),
          type: "CONTESTANT",
          firstName: String(fd.get("firstName") ?? "").trim(),
          email: String(fd.get("email") ?? "").trim(),
          country: String(fd.get("country") ?? "").trim(),
          talentCategory: String(fd.get("talentCategory") ?? ""),
          message: "Submitted from the homepage hero. No performance link yet, needs chasing.",
          marketingOptIn: fd.get("marketingOptIn") === "on",
          // Honeypot. The route answers 200 and writes nothing when it is filled.
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

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-form flex-col gap-[14px] border-t-[6px] border-t-brand bg-ground p-[clamp(24px,2.5vw,36px)] text-ink shadow-lg motion-safe:animate-dl-rise min-[901px]:justify-self-end"
      style={{ animationDelay: "500ms" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[clamp(22px,1.8vw,28px)] font-extrabold leading-[1.05] tracking-[-.03em]">
          Enter the contest
        </p>
        <span className="whitespace-nowrap text-eyebrow font-semibold uppercase text-brand-onLight">
          {statusLabel}
        </span>
      </div>

      <p className="m-0 text-[14px] leading-[1.5] text-neutral-700">
        Four fields, one minute. Send your performance link now or after you enter.
      </p>

      {status === "success" ? (
        <SuccessPanel title="You are in.">
          Check your inbox for the confirmation and the next steps.
        </SuccessPanel>
      ) : (
        <>
          {/* Bots fill this, people never see it. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute h-0 w-0 overflow-hidden opacity-0"
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">First name</span>
              <input
                name="firstName"
                required
                autoComplete="given-name"
                placeholder="Your name"
                className="field"
              />
            </label>
            <label className="block">
              <span className="label">Country</span>
              <input
                name="country"
                autoComplete="country-name"
                placeholder="Where you perform from"
                className="field"
              />
            </label>
          </div>

          <label className="block">
            <span className="label">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="field"
            />
          </label>

          <label className="block">
            <span className="label">Your talent</span>
            <select name="talentCategory" required defaultValue="" className="field">
              <option value="">Select one</option>
              {HERO_TALENTS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={status === "loading"}
            className="mt-[6px] w-full py-[18px] disabled:opacity-60"
          >
            {status === "loading" ? "Sending" : "Submit my entry"}
          </Button>

          <label className="flex cursor-pointer items-start gap-[10px] text-[12px] leading-[1.45] text-neutral-700">
            <input
              type="checkbox"
              name="marketingOptIn"
              defaultChecked
              className="mt-[2px] h-4 w-4 shrink-0 accent-brand"
            />
            Email me show announcements and reminders. One click to unsubscribe.
          </label>
        </>
      )}
    </form>
  );
}
