import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { env } from "@/lib/env";

/**
 * Self-hosted by next/font — no request to fonts.googleapis.com at runtime, which
 * is one render-blocking third-party round trip the old site pays on every page.
 *
 * Bebas Neue: tall condensed caps, one weight, built for titling. It carries the
 * broadcast feel at 96px and has no lowercase, which is fine because display type
 * here is always uppercase by design.
 * Inter: the body face. Wide weight range and it stays legible at 14px on a phone,
 * where most of this audience arrives from Facebook and YouTube.
 */
const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
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
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0C",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-gold focus:px-5 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
