"use client";

import { useId, useState } from "react";

import { Button } from "@/components/dl/Button";
import { SuccessPanel } from "@/components/dl/SuccessPanel";
import { cn } from "@/lib/cn";

type Status = "idle" | "loading" | "success" | "error";

/**
 * The newsletter capture, in the light editorial system.
 *
 * The business problem behind the rebuild is that a large social audience is
 * rented, not owned: every address captured here is one the client can reach
 * without an algorithm's permission.
 *
 * It has to sit on two grounds, so the ground is a prop rather than a caller's
 * className:
 *
 *   "paper"  the light ground. Boxed `.field` inputs, red `.btn .btn-primary`.
 *   "poster" the closing red field. A boxed input there reads as a hole punched
 *            in the poster, so the fields are `.field-underline` and the button
 *            goes black, since red on red is not a button.
 *
 * Success is the system's grey panel with a 4px red left rule, the same state
 * every other form on the site ends in.
 */
export function NewsletterForm({
  source = "homepage",
  ground = "paper",
  className,
}: {
  source?: string;
  ground?: "paper" | "poster";
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * Unique per INSTANCE, not per component. `source` is a label, not an
   * identifier: two instances sharing one would ship duplicate ids, and a label
   * resolves to the FIRST matching id in the document, so clicking one form's
   * "Email" would focus the other form's input. useId() is stable across the
   * server render and hydration. The colons React wraps it in are legal in an
   * id but need escaping in a CSS selector, so they are stripped.
   */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const onPoster = ground === "poster";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading" || status === "success") return;
    setStatus("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(fd.get("firstName") || "Friend"),
          email: String(fd.get("email") ?? "").trim(),
          // Honeypot. The route answers 200 and writes nothing when it is filled.
          website: String(fd.get("website") ?? ""),
          source,
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

  if (status === "success") {
    return (
      <SuccessPanel
        title="You're on the list"
        /*
          The panel is grey on both grounds. Only the left rule moves: a red
          rule on the red field would vanish into it, so on the poster it goes
          ink. Still 4px, still radius 0, still the same panel.
        */
        className={cn(onPoster && "border-l-ink", className)}
      >
        Show dates, entry deadlines and results will land in your inbox.
      </SuccessPanel>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      {/* Honeypot. Bots fill it, people never see it. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <div className={cn("flex flex-col gap-3", !onPoster && "sm:flex-row")}>
        <label className="sr-only" htmlFor={`nl-${uid}-name`}>
          First name
        </label>
        <input
          id={`nl-${uid}-name`}
          name="firstName"
          placeholder="First name"
          autoComplete="given-name"
          className={cn(onPoster ? "field-underline" : "field sm:max-w-[11rem]")}
        />

        <label className="sr-only" htmlFor={`nl-${uid}-email`}>
          Email address
        </label>
        <input
          id={`nl-${uid}-email`}
          name="email"
          type="email"
          required
          placeholder="you@email.com"
          autoComplete="email"
          aria-invalid={status === "error" || undefined}
          className={cn(
            onPoster ? "field-underline" : "field flex-1",
            // The error border is the brand red the focus state already uses,
            // rather than a colour that exists nowhere else in the system.
            status === "error" && !onPoster && "border-brand",
          )}
        />

        <Button
          type="submit"
          disabled={status === "loading"}
          className={cn(
            "shrink-0 disabled:opacity-50",
            // Red on the red field is not a button. Black is what the poster
            // uses, full width under the two rules.
            onPoster &&
              "mt-4 w-full border-ink bg-ink hover:border-neutral-900 hover:bg-neutral-900",
          )}
        >
          {status === "loading" ? "Sending" : "Notify me"}
        </Button>
      </div>

      {error && (
        <p
          className={cn("error-text", onPoster && "font-semibold text-white")}
          role="alert"
        >
          {error}
        </p>
      )}

      <p className={cn("help", onPoster && "text-white opacity-90")}>
        Show dates, entry deadlines and results. No spam, unsubscribe in one click.
      </p>
    </form>
  );
}
