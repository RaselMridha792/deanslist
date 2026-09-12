import { Suspense } from "react";
import { CaptureAttribution } from "@/components/site/CaptureAttribution";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Launcher } from "@/components/site/Launcher";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { GoogleTag } from "@/components/site/GoogleTag";
import { PageViewBeacon } from "@/components/site/PageViewBeacon";
import { TrackingConsent } from "@/components/site/TrackingConsent";
import { getGoogleAnalyticsId, getMetaPixelId, getSiteLinks } from "@/lib/settings";

/**
 * The public site's shell.
 *
 * Everything a visitor sees lives in this route group; /admin and /api sit
 * outside it and get none of this chrome. The engagement centre mounts here
 * rather than in the root layout for the same reason — a floating "enter the
 * contest" widget over the leads dashboard would be absurd. The Google tag is
 * here and not in the root layout for that reason too: dashboard pages, with
 * lead ids in their addresses, are not reported to Google.
 *
 * Launcher owns where and when the widget appears: hidden on /enter and
 * /thank-you, and on the homepage only after the hero has scrolled past.
 *
 * The channel links, the Meta Pixel id and the Google Analytics id are read
 * here, once per render, and handed down. All are set in the dashboard
 * (/admin/settings), so the client can change a link or turn measurement on
 * without a deploy.
 *
 * Rendered on every request, which is what makes that true. Reading the
 * database does not by itself stop Next.js from pre-rendering a page at build
 * time, and a page pre-rendered inside the Docker build has no database and so
 * no settings: /join and /privacy shipped without the Google tag, and would
 * have lost an Instagram link or a pixel the same way on every deploy until
 * someone happened to press Save. Every other public page already rendered per
 * request, so this costs nothing that was being saved.
 */
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [links, pixelId, gaId] = await Promise.all([
    getSiteLinks(),
    getMetaPixelId(),
    getGoogleAnalyticsId(),
  ]);

  return (
    <>
      {gaId && <GoogleTag id={gaId} />}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:border-2 focus:border-brand focus:bg-brand focus:px-5 focus:py-2 focus:text-btn focus:font-extrabold focus:uppercase focus:text-white"
      >
        Skip to content
      </a>
      {/* Records utm_* and the ad click id on the landing page, so an entry
          submitted two pages later still names the campaign that paid for it. */}
      <Suspense fallback={null}>
        <CaptureAttribution />
      </Suspense>

      {/* Counts the page for the dashboard's analytics. No cookie and nothing
          stored on the device, so it runs for everyone without the banner. */}
      <PageViewBeacon />

      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <Launcher>
        <ChatWidget links={links} />
      </Launcher>

      {/* No ids, no banner. MetaPixel reads the search params to count
          client-side navigations, so it needs a Suspense boundary of its own. */}
      {(pixelId || gaId) && (
        <Suspense fallback={null}>
          <TrackingConsent pixelId={pixelId} gaId={gaId} />
        </Suspense>
      )}
    </>
  );
}
