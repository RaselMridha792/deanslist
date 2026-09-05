import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Launcher } from "@/components/site/Launcher";
import { ChatWidget } from "@/components/chat/ChatWidget";

/**
 * The public site's shell.
 *
 * Everything a visitor sees lives in this route group; /admin and /api sit
 * outside it and get none of this chrome. The engagement centre mounts here
 * rather than in the root layout for the same reason — a floating "enter the
 * contest" widget over the leads dashboard would be absurd.
 *
 * Launcher owns where and when the widget appears: hidden on /enter and
 * /thank-you, and on the homepage only after the hero has scrolled past.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:border-2 focus:border-brand focus:bg-brand focus:px-5 focus:py-2 focus:text-btn focus:font-extrabold focus:uppercase focus:text-white"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <Launcher>
        <ChatWidget />
      </Launcher>
    </>
  );
}
