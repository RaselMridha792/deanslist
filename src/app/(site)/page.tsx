import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { StatsBand } from "@/components/home/StatsBand";
import { WinnerSpotlight } from "@/components/home/WinnerSpotlight";
import { VideoHighlights } from "@/components/home/VideoHighlights";
import { GalleryStrip } from "@/components/home/GalleryStrip";
import { SponsorStrip } from "@/components/home/SponsorStrip";
import { NewsletterCTA } from "@/components/home/NewsletterCTA";
import { organizationJsonLd, jsonLdScriptProps } from "@/lib/seo";
import {
  getCurrentShow,
  getStats,
  getLatestWinner,
  getEpisodes,
  getGallery,
  getSponsors,
} from "@/lib/queries";

// Content is dashboard-managed, so the page is rendered per request rather than
// baked at build time. Swap to a revalidate window once traffic justifies it.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [show, stats, winner, episodes, gallery, sponsors] = await Promise.all([
    getCurrentShow(),
    getStats(),
    getLatestWinner(),
    getEpisodes(),
    getGallery(),
    getSponsors(),
  ]);

  return (
    <>
      {/* Organization markup, so search engines resolve the brand and its real
          social profiles rather than guessing. */}
      <script {...jsonLdScriptProps(organizationJsonLd())} />
      <Hero show={show} />
      <StatsBand stats={stats} />
      <HowItWorks />
      <WinnerSpotlight winner={winner} />
      <VideoHighlights episodes={episodes} />
      <GalleryStrip images={gallery} />
      <SponsorStrip sponsors={sponsors} />
      <NewsletterCTA />
    </>
  );
}
