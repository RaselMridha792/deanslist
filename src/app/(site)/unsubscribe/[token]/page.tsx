import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { ButtonLink } from "@/components/dl/Button";
import { SITE } from "@/content/site";
import { readUnsubscribeState } from "@/lib/unsubscribe";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Stop receiving show announcements from The Dean's List.",
  robots: { index: false, follow: false, nocache: true },
};

/** A token page is per-recipient and must never be cached or prerendered. */
export const dynamic = "force-dynamic";

/**
 * Unsubscribe confirmation.
 *
 * This page only ever reads. The removal happens on the POST to
 * /api/unsubscribe, and that split is the entire point of the screen: Gmail,
 * Outlook and corporate link scanners fetch URLs they find in mail before a
 * human ever sees them, so an unsubscribe that fired on GET would quietly
 * remove people who never clicked. One extra click is the cost of not doing
 * that to the client's list.
 *
 * The form is plain HTML posting to a route handler — no client component, no
 * JavaScript required. An unsubscribe that depends on a bundle loading is an
 * unsubscribe that fails for the people most likely to want it.
 */

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
};

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { state: flash } = await searchParams;

  const state = await readUnsubscribeState(token);

  if (state.status === "invalid") {
    return (
      <Shell eyebrow="Unsubscribe" title="This link is not valid">
        <p className="text-neutral-800">
          The link has been altered, truncated by a mail client, or belongs to
          an older mailing. Nothing has changed on your subscription.
        </p>
        <p className="mt-4 text-neutral-700">
          Open the most recent email from us and use the unsubscribe link at the
          bottom of it, or write to{" "}
          <a
            href={`mailto:${SITE.email}`}
            className="text-brand-onLight underline underline-offset-4"
          >
            {SITE.email}
          </a>{" "}
          and we will take you off the list by hand.
        </p>
        <Actions />
      </Shell>
    );
  }

  if (state.status === "unknown") {
    return (
      <Shell eyebrow="Unsubscribe" title="Not on the list">
        <p className="text-neutral-800">
          This address is not on our mailing list, so there is nothing to
          remove. You will not receive show announcements from us.
        </p>
        <Actions />
      </Shell>
    );
  }

  // The POST redirects back here with ?state=done. The row now reads as
  // "already", so the flash is what distinguishes "we just did it" from
  // "you did this before".
  if (flash === "done") {
    return (
      <Shell eyebrow="Unsubscribed" title="You are off the list">
        <p className="text-neutral-800">
          <span className="text-ink">{state.maskedEmail}</span> has been removed
          from show announcements. You will not be added back by any future
          import.
        </p>
        <p className="mt-4 text-neutral-700">
          Anything you already sent us — an entry, an application, an enquiry —
          is untouched, and we can still reply to it directly. This only stops
          the marketing emails.
        </p>
        <Actions />
      </Shell>
    );
  }

  if (state.status === "already") {
    return (
      <Shell eyebrow="Unsubscribe" title="Already unsubscribed">
        <p className="text-neutral-800">
          <span className="text-ink">{state.maskedEmail}</span> is already off
          the list. No further action is needed, and nothing you do on this page
          will put you back on it.
        </p>
        <Actions />
      </Shell>
    );
  }

  return (
    <Shell eyebrow="Unsubscribe" title="Stop these emails?">
      <p className="text-neutral-800">
        We will stop sending show announcements, reminders and results to{" "}
        <span className="text-ink">{state.maskedEmail}</span>.
      </p>
      <p className="mt-4 text-neutral-700">
        This is where the show dates go out first. Social platforms decide who
        sees a post; email does not.
      </p>

      <form method="post" action="/api/unsubscribe" className="mt-8">
        {/*
          Honeypot, for consistency with every other public form here. On this
          route a filled field is logged and the request is still honoured —
          see the comment in /api/unsubscribe. Refusing an opt-out is never the
          safe default.
        */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute h-0 w-0 overflow-hidden opacity-0"
        />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="redirect" value="1" />

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className="btn btn-primary">
            Unsubscribe me
          </button>
          <Link href="/" className="btn btn-ghost">
            Keep me on the list
          </Link>
        </div>
        <p className="help">
          One click. No survey, no &ldquo;are you sure&rdquo; a second time.
        </p>
      </form>
    </Shell>
  );
}

/* --------------------------------------------------------------- chrome */

function Shell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} />
      <section className="section">
        <div className="shell">
          <div className="max-w-[60ch]">
            <div className="card p-8 sm:p-10">{children}</div>
          </div>
        </div>
      </section>
    </>
  );
}

function Actions() {
  return (
    <div className="mt-8 flex flex-wrap gap-4">
      <ButtonLink href="/" variant="outline">
        Back to the site
      </ButtonLink>
      <ButtonLink href="/privacy" variant="ghost">
        How we handle your data
      </ButtonLink>
    </div>
  );
}
