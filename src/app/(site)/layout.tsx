import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ChatWidget } from "@/components/chat/ChatWidget";

/**
 * The public site's shell.
 *
 * Everything a visitor sees lives in this route group; /admin and /api sit
 * outside it and get none of this chrome. The engagement centre mounts here
 * rather than in the root layout for the same reason — a floating "enter the
 * contest" widget over the leads dashboard would be absurd.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-gold focus:px-5 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <ChatWidget />
    </>
  );
}
