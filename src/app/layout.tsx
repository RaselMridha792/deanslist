import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://deanslist.live";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "The Dean's List | Global Talent Competition",
    template: "%s | The Dean's List",
  },
  description:
    "The Dean's List is a global online talent competition. Enter, perform, and win cash prizes on Crown the Sound and Drop That Mike.",
  openGraph: {
    type: "website",
    siteName: "The Dean's List",
    url: siteUrl,
    images: [{ url: "/og.jpg", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
