"use client";

import { useId, useState } from "react";

import { Button } from "@/components/dl/Button";
import { cn } from "@/lib/cn";
import { readAttribution } from "@/lib/attribution";

/**
 * The routed inquiry form.
 *
 * Split out of page.tsx so the page itself can be a Server Component: it needs
 * to read the channel links from the dashboard, and it gets its own title and
 * description back, which a "use client" page cannot export.
 *
 * The form stays here because its whole job is state: the selected route and
 * the success panel. The shared LeadForm cannot do this one — it takes `type`
 * as a fixed prop, and this design needs four routes that each map to a
 * different LeadType, plus a subject line and a single name field.
 *
 * Every field lands in the client's own database through /api/leads, which is
 * rate limited, honeypotted and Zod validated there.
 */

/**
 * The four routes, in the design's order and wording.
 *
 * `leadType` is the mapping to the LeadType enum. Support is CONTESTANT, which
 * is the same mapping INQUIRY_TYPES already makes for "Contest support": someone
 * asking for help with an entry belongs with the contestant team. It shares that
 * type with the entry funnel, so the chosen route is written into the message
 * body as well and nothing about the request is ambiguous in the dashboard.
 */
const INQUIRY_ROUTES = [
  { label: "General", leadType: "GENERAL" },
  { label: "Press", leadType: "PRESS" },
  { label: "Sponsorship", leadType: "SPONSOR" },
  { label: "Support", leadType: "CONTESTANT" },
] as const;

type Route = (typeof INQUIRY_ROUTES)[number];

export function ContactForm() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const fieldId = (name: string) => `contact-${uid}-${name}`;

  const [route, setRoute] = useState<Route>(INQUIRY_ROUTES[0]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const fd = new FormData(e.currentTarget);

    /*
      The design asks for one "Your name" field; the schema stores first and last
      separately, and firstName is the required one. Splitting on the first space
      keeps the dashboard's name columns useful without making a visitor fill in
      two boxes. A single-word name stays entirely in firstName.
    */
    const fullName = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ");
    const [firstName, ...rest] = fullName.split(" ");

    /*
      Subject and the chosen route have no column of their own, so they ride at
      the top of `message` — the same thing LeadForm does with its extras, so
      nothing a visitor typed is silently dropped.
    */
    const subject = String(fd.get("subject") ?? "").trim();
    const message = [
      `Inquiry: ${route.label}`,
      ...(subject ? [`Subject: ${subject}`] : []),
      "",
      String(fd.get("message") ?? "").trim(),
    ].join("\n");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...readAttribution(),
          type: route.leadType,
          firstName: firstName || fullName,
          lastName: rest.join(" "),
          email: String(fd.get("email") ?? ""),
          message,
          // No consent checkbox on this design, so nothing is opted in. A reply
          // to an inquiry is not marketing and does not need one.
          marketingOptIn: false,
          website: String(fd.get("website") ?? ""),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="border-t-[6px] border-brand pt-6">
        <p className="success-panel text-body font-semibold" role="status">
          Message received. The right person will reply by email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t-[6px] border-brand pt-6">
      {/* Honeypot. The route answers 200 and writes nothing when it is filled. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      {/* A fieldset so the group carries its own accessible name. `legend` takes
          phrasing content, so the kicker is the class rather than the component. */}
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="kicker mb-5 p-0">Inquiry type</legend>
        {/*
          A real radio group, visually a segmented control: the input is
          sr-only rather than absent, so arrow keys move between routes and a
          screen reader announces which one is selected.
        */}
        <div className="grid grid-cols-2 gap-[2px] border-2 border-rule bg-rule sm:grid-cols-4">
          {INQUIRY_ROUTES.map((r) => {
            const active = r.label === route.label;
            return (
              <label key={r.label} className="grid cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={r.label}
                  checked={active}
                  onChange={() => setRoute(r)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex min-h-[44px] items-center px-[14px] py-3 text-btn font-semibold uppercase",
                    "transition-colors duration-200 ease-dl",
                    "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px]",
                    active
                      ? "bg-brand text-white peer-focus-visible:outline-white"
                      : "bg-ground hover:bg-surface peer-focus-visible:outline-brand",
                  )}
                >
                  {r.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={fieldId("name")}>
            Your name
          </label>
          <input
            id={fieldId("name")}
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Full name"
            className="field min-h-[48px]"
          />
        </div>
        <div>
          <label className="label" htmlFor={fieldId("email")}>
            Email
          </label>
          <input
            id={fieldId("email")}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="field min-h-[48px]"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor={fieldId("subject")}>
          Subject
        </label>
        <input
          id={fieldId("subject")}
          name="subject"
          type="text"
          required
          placeholder="What is this about"
          className="field min-h-[48px]"
        />
      </div>

      <div>
        <label className="label" htmlFor={fieldId("message")}>
          Message
        </label>
        <textarea
          id={fieldId("message")}
          name="message"
          required
          placeholder="Tell us what you need"
          className="field min-h-[140px] resize-y"
        />
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={status === "loading"}
        className="w-full disabled:opacity-50"
      >
        {status === "loading" ? "Sending" : "Send message"}
      </Button>
    </form>
  );
}
