"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureAttribution } from "@/lib/attribution";

/**
 * Records the campaign markers on the page a visitor lands on.
 *
 * Mounted once in the public layout, and it reads the URL rather than taking
 * props, so it works on every route including ones added later without anyone
 * remembering to wire it up.
 *
 * It re-runs on navigation because a visitor can arrive on a second campaign
 * URL within the same session — and the capture itself keeps the first value it
 * saw, so re-running is safe and the later click cannot steal the credit.
 *
 * useSearchParams opts the subtree into client-side rendering, which is why
 * this is a leaf with no children rather than a wrapper.
 */
export function CaptureAttribution() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    captureAttribution();
  }, [pathname, params]);

  return null;
}
