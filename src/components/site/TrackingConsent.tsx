"use client";

import { useEffect, useState } from "react";
import { MetaPixel } from "@/components/site/MetaPixel";
import { allows, answered, readConsent, writeConsent, type Choice, type Consent, type Tool } from "@/lib/consent";

/**
 * The cookie banner, and what each answer switches on.
 *
 * Two tools can sit behind it, each turned on by an id in the dashboard:
 *
 *   Google Analytics. Its tag is already on the page (GoogleTag.tsx) with
 *   analytics storage denied, so no cookie exists until someone allows it.
 *   "Allow" tells the tag storage is granted; "No thanks" changes nothing.
 *
 *   The Meta Pixel. Not loaded at all until "Allow": no script, no cookie, no
 *   request to Facebook.
 *
 * The answer is remembered with the list of tools it was given for (see
 * src/lib/consent.ts), so switching a new tool on asks again rather than
 * treating an old yes as covering it. With neither id set, this is not
 * rendered at all and there is no banner.
 *
 * localStorage rather than a cookie: nothing on the server needs to read it,
 * and a cookie set to record "no cookies please" is its own small joke.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function copy(tools: Tool[]) {
  const ga = tools.includes("ga");
  const pixel = tools.includes("pixel");
  if (ga && pixel) {
    return {
      label: "Analytics and advertising cookies",
      text: "We use Google Analytics to see how the site is used, and Meta's pixel to see which ads bring performers here. Their cookies are set only if you allow them, and the site works the same either way.",
    };
  }
  if (ga) {
    return {
      label: "Analytics cookies",
      text: "We use Google Analytics to see which pages people read and how they find us. Its cookies are set only if you allow them, and the site works the same either way.",
    };
  }
  return {
    label: "Advertising cookies",
    text: "We would like to measure which ads bring performers to the site, using Meta's pixel. Nothing is loaded until you say yes, and the site works the same either way.",
  };
}

export function TrackingConsent({ pixelId, gaId }: { pixelId: string | null; gaId: string | null }) {
  const tools: Tool[] = [...(gaId ? (["ga"] as const) : []), ...(pixelId ? (["pixel"] as const) : [])];
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);

  // Read after mount: the server cannot know, and rendering the bar during
  // hydration for someone who already answered would flash it.
  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  const decide = (choice: Choice) => {
    writeConsent(choice, tools);
    if (choice === "granted" && gaId) {
      window.gtag?.("consent", "update", { analytics_storage: "granted" });
    }
    setConsent({ choice, tools });
  };

  if (!ready || tools.length === 0) return null;

  const pixel = pixelId && allows(consent, "pixel") ? <MetaPixel pixelId={pixelId} /> : null;
  if (answered(consent, tools)) return pixel;

  const { label, text } = copy(tools);
  return (
    <>
      {pixel}
      <div
        role="region"
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-[60] border-t-2 border-brand bg-ink text-ground"
      >
        <div className="mx-auto flex max-w-shell flex-col gap-4 px-gutter py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[70ch] text-[14px] leading-relaxed text-ground/85">
            {text}{" "}
            <a href="/privacy" className="underline underline-offset-4 hover:text-brand-onDark">
              How we handle data
            </a>
            .
          </p>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => decide("denied")}
              className="btn btn-outline-dark min-h-[44px]"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={() => decide("granted")}
              className="btn btn-primary min-h-[44px]"
            >
              Allow
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
