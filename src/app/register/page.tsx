import type { Metadata } from "next";
import { Suspense } from "react";

import { CaptureAttribution } from "@/components/site/CaptureAttribution";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { SITE } from "@/content/site";
import { mediaImage } from "@/lib/media";
import { formatStat, getCurrentShow, getStats } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Register to perform",
  description:
    "Register to perform on a Dean's List show. Free to enter, cash prizes, voted live by the audience. Name, email and your talent is all it takes.",
  // A paid landing page should not compete with the site's own pages in search.
  // The ad is how people get here; an indexed duplicate of /enter only splits
  // the ranking of the page that is meant to rank.
  robots: { index: false, follow: true },
};

// The show and the prize figure are dashboard-managed.
export const dynamic = "force-dynamic";

/**
 * The landing page for paid traffic.
 *
 * It lives OUTSIDE the (site) route group on purpose, so it inherits no header,
 * no footer and no chat launcher. That is the whole difference between this and
 * /enter: a landing page paid for by the click has exactly one thing it wants
 * the visitor to do, and every navigation link on it is a way to leave without
 * doing that. /enter keeps the full site chrome because people reach it from
 * inside the site, where leaving to read another page is a reasonable thing to
 * want.
 *
 * What is the same is the design system — ink, red, Archivo, square corners.
 * An ad that lands somewhere that looks like a different company converts worse,
 * not better.
 *
 * The page renders its whole argument above the form on mobile and beside it on
 * desktop, and the form is visible without scrolling on both.
 */
export default async function RegisterPage() {
  const [show, stats] = await Promise.all([getCurrentShow(), getStats()]);

  const prize = show?.prizeAmount
    ? `$${show.prizeAmount.toLocaleString("en-US")}`
    : null;

  // Audience size is the strongest thing this page can say, and it is only said
  // when a verified figure exists. getStats() returns verified rows only.
  const reach = stats.find((s) => s.key === "youtube_subscribers");

  const points = [
    {
      title: "Free to enter",
      body: "There is no entry fee. Registering is free and performing is free, and no card details are taken at any point.",
    },
    {
      title: "A new show every week",
      body: show?.cadence
        ? `${show.cadence}, live on YouTube and Facebook.`
        : "Live on YouTube and Facebook, with the audience voting in real time.",
    },
    {
      title: prize ? `${prize} on the line` : "Cash prizes",
      body: prize
        ? `The current show carries a ${prize} pool, paid to the winner the audience chooses.`
        : "Winners are paid in cash and take a permanent place on the Principal's Roll.",
    },
    {
      title: "Perform from home",
      body: "No travel and no venue. Send a video from wherever you are, and the audience decides.",
    },
  ];

  return (
    <main className="min-h-screen bg-ink text-ground">
      <Suspense fallback={null}>
        <CaptureAttribution />
      </Suspense>

      {/* The one piece of chrome. Not a link: this page has a single exit and it
          is the submit button. */}
      <div className="border-b-2 border-rule-dark">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-6 px-gutter py-4">
          <img
            src={`${mediaImage("/media/brand/logo")}.png`}
            alt={SITE.name}
            width={46}
            height={41}
            className="h-[46px] w-auto"
          />
          <p className="text-kicker font-semibold uppercase text-brand-onDark">
            Free to enter
          </p>
        </div>
      </div>

      <div className="relative isolate overflow-hidden">
        {/* Ambient, and quiet enough that it never competes with the form. */}
        <div className="absolute inset-0 -z-20 opacity-[.28]">
          <GrayscaleImage
            src="/media/gallery/cts-03"
            alt=""
            priority
            hover={false}
            sizes="100vw"
            className="h-full w-full"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink from-30% to-ink/60" />

        <div className="mx-auto grid max-w-shell gap-[clamp(32px,5vw,80px)] px-gutter py-[clamp(32px,5vw,72px)] min-[901px]:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] min-[901px]:items-start">
          <div>
            <h1 className="text-balance text-[clamp(36px,5.5vw,76px)] font-extrabold uppercase leading-[.92] tracking-[-.04em]">
              {show?.title ? (
                <>
                  Perform on
                  <br />
                  {show.title}.
                </>
              ) : (
                <>
                  Any talent.
                  <br />
                  Big cash.
                </>
              )}
            </h1>

            <p className="mt-6 max-w-[46ch] text-pretty text-lede text-ground/85">
              {SITE.description}
            </p>

            {reach && (
              <p className="mt-6 inline-flex items-baseline gap-3 border-2 border-rule-dark px-4 py-3">
                <span className="text-[clamp(22px,2.4vw,34px)] font-extrabold leading-none tracking-[-.03em]">
                  {formatStat(reach)}
                </span>
                <span className="text-kicker font-semibold uppercase text-ground/70">
                  {reach.label}
                </span>
              </p>
            )}

            <div className="mt-[clamp(28px,3vw,44px)] grid gap-[2px] bg-rule-dark sm:grid-cols-2">
              {points.map((p) => (
                <div key={p.title} className="bg-ink p-5">
                  <h2 className="text-[17px] font-extrabold leading-tight tracking-[-.02em]">
                    {p.title}
                  </h2>
                  <p className="mt-2 text-pretty text-[14px] leading-relaxed text-ground/75">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-ink">
            <RegisterForm />

            <p className="mt-5 text-[13px] leading-relaxed text-ground/60">
              We use your details to contact you about the contest and to send
              the prize if you win. Read how we handle them in our{" "}
              <a
                href="/privacy"
                className="text-brand-onDark underline underline-offset-4"
              >
                privacy policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
