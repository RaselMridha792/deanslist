"use client";

import { useEffect, useState } from "react";
import { MetaPixel } from "@/components/site/MetaPixel";

/**
 * Ad measurement, and the choice in front of it.
 *
 * /privacy says the public site sets no advertising cookies, and that if
 * tracking is ever added it will sit behind a consent banner. So the Meta
 * Pixel loads only after someone accepts: no script, no cookie, no request to
 * Facebook before that. Declining is remembered too, so the bar is asked once
 * and not on every page.
 *
 * The choice lives in localStorage rather than a cookie: nothing needs to read
 * it on the server, and a cookie set to record "no cookies please" is its own
 * small joke.
 *
 * Rendered only when the client has set a Pixel ID in the dashboard. With no
 * id there is nothing to consent to, and no bar appears.
 */
const STORAGE_KEY = "dl_ads_consent";
type Choice = "granted" | "denied";

function readChoice(): Choice | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    // Private mode or storage blocked: ask again next time, track nothing now.
    return null;
  }
}

export function TrackingConsent({ pixelId }: { pixelId: string }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);

  // Read after mount: the server has no way to know, and rendering the bar
  // during hydration for someone who already answered would flash it.
  useEffect(() => {
    setChoice(readChoice());
    setReady(true);
  }, []);

  const decide = (next: Choice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not storable. The choice still holds for this page view.
    }
    setChoice(next);
  };

  if (!ready) return null;
  if (choice === "granted") return <MetaPixel pixelId={pixelId} />;
  if (choice === "denied") return null;

  return (
    <div
      role="region"
      aria-label="Advertising cookies"
      className="fixed inset-x-0 bottom-0 z-[60] border-t-2 border-brand bg-ink text-ground"
    >
      <div className="mx-auto flex max-w-shell flex-col gap-4 px-gutter py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[70ch] text-[14px] leading-relaxed text-ground/85">
          We would like to measure which ads bring performers to the site, using
          Meta&apos;s pixel. Nothing is loaded until you say yes, and the site works the
          same either way.{" "}
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
  );
}
