"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Counts a page view for the analytics screen, once per page.
 *
 * No cookie, no localStorage, no identifier of any kind: the browser sends the
 * page it is on and, for the first page only, where it came from. Everything
 * that turns that into "one visitor from Facebook in Canada" happens on the
 * server (src/app/api/collect/route.ts), and none of it is stored on the
 * visitor's device. That is why this needs no consent banner, unlike Google
 * Analytics and the Meta Pixel, which set cookies and wait for "Allow".
 *
 * "First page" means the first page of this page load. Next.js changes pages
 * without reloading, so `document.referrer` still names the site someone
 * arrived from three pages later; sending it on every page would credit
 * Facebook with the whole visit, five times over. It goes on the first only.
 *
 * sendBeacon because it survives the page being closed or navigated away from,
 * which is exactly when a short visit is recorded. Posted as text, so a
 * same-origin beacon never needs a preflight.
 *
 * Only the pathname changes a page. A filter that updates the query string is
 * the same page, and the query string is never sent: it can carry an email.
 */
export function PageViewBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  const sentAny = useRef(false);

  useEffect(() => {
    // Strict Mode runs effects twice in development; this keeps it to one view.
    if (!pathname || last.current === pathname) return;
    last.current = pathname;

    const isEntry = !sentAny.current;
    sentAny.current = true;

    const query = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      p: window.location.pathname,
      e: isEntry,
      r: isEntry ? document.referrer || null : null,
      u: isEntry
        ? {
            source: query.get("utm_source"),
            medium: query.get("utm_medium"),
            campaign: query.get("utm_campaign"),
          }
        : null,
      t: navigator.maxTouchPoints > 1,
    });

    try {
      if (navigator.sendBeacon?.("/api/collect", body)) return;
    } catch {
      // Some privacy extensions stub sendBeacon out. Fall through.
    }
    fetch("/api/collect", {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "text/plain" },
    }).catch(() => {
      // Measurement never gets to raise an error in front of a visitor.
    });
  }, [pathname]);

  return null;
}
