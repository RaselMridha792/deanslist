"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The Meta Pixel, loaded only when the client has put an id in the dashboard.
 *
 * Nothing is rendered without one: no script, no image, no cookie. That is the
 * point of driving it from a setting rather than a build — the client can turn
 * their ad measurement on the day they start advertising, and off again.
 *
 * Two details that are easy to get wrong in an app that navigates without
 * reloading:
 *
 *   the base snippet fires PageView once, when it loads. Every later page is a
 *   client-side navigation the pixel never hears about, so the effect below
 *   sends one on each path change and skips the first, which the snippet has
 *   already counted.
 *
 *   `afterInteractive` keeps the script off the critical path. The pixel is
 *   measurement; it must never be what a visitor waits for.
 */
declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
  }
}

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname, search]);

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
