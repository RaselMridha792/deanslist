import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/dl/Button";
import { Kicker } from "@/components/dl/Kicker";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * The application's 404.
 *
 * It has to live at the root, because in the App Router an unmatched URL is
 * handled by app/not-found and never by a nested one. src/app/admin/not-found
 * covers only notFound() thrown inside the dashboard, which is the case that
 * matters there (a deleted show, a bad id), but it does not catch /admin/typo.
 *
 * It renders outside the (site) group, so there is no header or footer around
 * it. That is deliberate: the old site's 404 was a Joomla error page with no
 * way back, and the redirects in next.config.ts exist so the URLs people
 * actually have in hand never land here. Anything that still does gets the
 * three routes worth offering rather than a full navigation.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center bg-ink text-ground">
      <div className="shell py-section">
        <Kicker onDark>404</Kicker>
        <h1 className="mt-5 max-w-[16ch] text-balance text-hero font-extrabold uppercase">
          That page is not here.
        </h1>
        <p className="mt-5 max-w-[52ch] text-pretty text-lede text-ground/85">
          The link may be old, or the show it pointed at may have finished. The
          contest itself is still running.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <ButtonLink href="/enter" size="lg">
            Enter the contest
          </ButtonLink>
          <ButtonLink href="/" variant="outline-dark" size="lg">
            Back to the homepage
          </ButtonLink>
        </div>

        <p className="mt-10 text-[13px] text-ground/70">
          Looking for something specific?{" "}
          <Link
            href="/shows"
            className="text-brand-onDark underline underline-offset-4"
          >
            The shows
          </Link>
          {", "}
          <Link
            href="/winners"
            className="text-brand-onDark underline underline-offset-4"
          >
            the winners
          </Link>
          {", or "}
          <Link
            href="/contact"
            className="text-brand-onDark underline underline-offset-4"
          >
            write to us
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
