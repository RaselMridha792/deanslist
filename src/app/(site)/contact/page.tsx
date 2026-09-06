"use client";

import { useId, useState } from "react";

import { Button, ButtonLink } from "@/components/dl/Button";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { SITE } from "@/content/site";
import { cn } from "@/lib/cn";
import { readAttribution } from "@/lib/attribution";

/**
 * Contact — the routed inquiry page.
 *
 * The old site's "Contact Us" is one of 42 `href="#"` links and goes nowhere.
 * This is the page that has to exist for the rebuild to mean anything.
 *
 * WHY THIS FILE IS A CLIENT COMPONENT, and what it costs
 * ------------------------------------------------------
 * The page's whole job is in its first control: four routes that decide who
 * reads the message. "General / Press / Sponsorship / Support" are not decoration
 * on one generic form — each maps to a different LeadType, so /api/leads files
 * the lead in the right queue and the dashboard can filter it. The shared
 * LeadForm takes `type` as a fixed prop and cannot do that, and its field set is
 * a different form to the one this design specifies (no subject line, a split
 * first/last name, a select in place of the segmented control). So the form is
 * built here, against the design, and needs state for the selected route and the
 * success panel.
 *
 * The cost is `export const metadata`, which Next.js disallows in a "use client"
 * module: /contact falls back to the root layout's default title and description
 * rather than carrying its own. That is recoverable in one move by whoever owns
 * src/components/forms — lift everything from `INQUIRY_ROUTES` down to the end
 * of ContactForm into src/components/forms/ContactForm.tsx, drop the directive
 * from this file, and the page becomes a Server Component with its metadata
 * back. It is not done here only because this task owns this file alone.
 *
 * Every field lands in the client's own database through the existing
 * /api/leads route — rate limited, honeypotted and Zod validated there.
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

/**
 * The handle a social URL ends in: "@DeansList2025", "Deanslistltd2025".
 *
 * Derived rather than typed out twice, so the label cannot drift from the link
 * it points at when the client edits the URL.
 */
function handleOf(url: string): string {
  return url.replace(/\/+$/, "").split("/").pop() ?? url;
}

const DETAILS: { label: string; value: string; href?: string }[] = [
  { label: "Email", value: SITE.email, href: `mailto:${SITE.email}` },
  {
    label: "Studio",
    value: `${SITE.address.line1}, ${SITE.address.city}, ${SITE.address.state} ${SITE.address.postalCode}`,
  },
  {
    label: "YouTube",
    value: handleOf(SITE.socials.youtube),
    href: SITE.socials.youtube,
  },
  {
    label: "Facebook",
    value: handleOf(SITE.socials.facebook),
    href: SITE.socials.facebook,
  },
];

/** Shared by the four detail rows. One clamp, declared once. */
const DETAIL_VALUE = "font-extrabold leading-[1.3] tracking-[-.02em] text-[clamp(16px,1.3vw,20px)]";

export default function ContactPage() {
  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-ink text-ground">
        <div className="shell grid items-end gap-8 pb-[clamp(40px,5vw,72px)] pt-[clamp(56px,7vw,120px)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="animate-dl-rise">
            <Kicker onDark>Contact</Kicker>
            <h1 className="mt-5 text-hero font-extrabold uppercase text-balance">
              Talk to the team.
            </h1>
          </div>
          {/* Delay is inline, not a utility: `animate-dl-rise` is the animation
              shorthand, so a class-based delay is a coin toss on source order. */}
          <p
            className="animate-dl-rise max-w-[44ch] text-lede text-ground/85 text-pretty"
            style={{ animationDelay: "200ms" }}
          >
            General questions, press, sponsorship and support. Pick a route so it lands with the
            right person.
          </p>
        </div>
      </section>

      {/* --------------------------------------------- details and inquiry */}
      <section className="shell py-section">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-24">
          {/*
            The rules between rows are a 2px gap over a rule-coloured background,
            not per-row borders — the same construction as CellGrid, so the last
            row carries no trailing rule and needs no override.
          */}
          <Reveal className="flex flex-col gap-[2px] border-t-2 border-rule bg-rule">
            {DETAILS.map((d) => (
              <div key={d.label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 bg-ground py-5">
                <span className="pt-1 text-eyebrow uppercase text-neutral-600">{d.label}</span>
                {d.href ? (
                  /*
                    The negative margin buys the 44px tap target the handoff asks
                    for without adding 20px to the row: the link's box grows, the
                    row's rhythm does not.
                  */
                  <a
                    href={d.href}
                    {...(d.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className={cn(
                      DETAIL_VALUE,
                      "-my-[10px] inline-flex items-center break-words py-[10px] transition-colors duration-200 ease-dl hover:text-brand-onLight",
                    )}
                  >
                    {d.value}
                  </a>
                ) : (
                  <span className={DETAIL_VALUE}>{d.value}</span>
                )}
              </div>
            ))}

            {/*
              Last row of the same stack, so the 2px rule above it comes free.
              Contest entries have their own four-step funnel and their own
              schema fields; a message typed into this box would arrive with none
              of them, so the page says so before anyone starts typing.
            */}
            <div className="bg-ink p-[clamp(20px,2.5vw,32px)] text-ground">
              <Kicker onDark className="mb-2.5">
                Want to perform?
              </Kicker>
              <p className="mb-4 text-body text-ground/85">
                Contestant entries do not go through this form.
              </p>
              <ButtonLink href="/enter" size="lg">
                Enter the contest
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal index={1}>
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------- form */

function ContactForm() {
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
