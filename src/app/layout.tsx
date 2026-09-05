import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { env } from "@/lib/env";

/**
 * One family for the whole site, per the design handoff.
 *
 * Archivo at 400 / 600 / 800. Hierarchy comes from weight and size rather than
 * from a second face, which is what keeps an editorial system this dense from
 * looking busy. 800 carries every display heading and every button label; 600
 * the kickers and nav; 400 body copy.
 *
 * Self-hosted by next/font, so there is no render-blocking request to
 * fonts.googleapis.com — the old site pays for two of those on every page.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const siteUrl = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "The Dean's List | Global Talent Competition",
    template: "%s | The Dean's List",
  },
  description:
    "A global online talent competition. Perform from home, get voted on live, and win a cash prize and a place on the Principal's Roll.",
  applicationName: "The Dean's List",
  openGraph: {
    type: "website",
    siteName: "The Dean's List",
    url: siteUrl,
    title: "The Dean's List | Global Talent Competition",
    description:
      "Perform from home, get voted on live, and win a cash prize and a place on the Principal's Roll.",
    // The old site sets og:image to the site root — an HTML document, not an
    // image — which is exactly why its share previews never render. This points
    // at a real 1200x630 file; see scripts/make-og-image.mjs.
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "The Dean's List" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Dean's List | Global Talent Competition",
    description:
      "Perform from home, get voted on live, and win a cash prize and a place on the Principal's Roll.",
    images: ["/og.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#201e1d",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      {/* No site chrome here. The public header and footer belong to the
          (site) route group; the dashboard has its own shell. Putting them in
          the root layout wrapped /admin in the visitor navigation, which is how
          the leads table ended up under a "WHAT IS IT / SHOWS / WINNERS" menu. */}
      <body>{children}</body>
    </html>
  );
}
