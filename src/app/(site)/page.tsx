import { Hero } from "@/components/home/Hero";
import { Ticker } from "@/components/home/Ticker";
import { StatsBand } from "@/components/home/StatsBand";
import { HowItWorks } from "@/components/home/HowItWorks";
import { WinnerSpotlight } from "@/components/home/WinnerSpotlight";
import { ClipReel } from "@/components/home/ClipReel";
import { WatchGrid } from "@/components/home/WatchGrid";
import { GalleryMarquee } from "@/components/home/GalleryMarquee";
import { NewsletterPoster } from "@/components/home/NewsletterPoster";
import { organizationJsonLd, jsonLdScriptProps } from "@/lib/seo";
import {
  getCurrentShow,
  getShows,
  getStats,
  getLatestWinner,
  getEpisodes,
  getGallery,
} from "@/lib/queries";

// Content is dashboard-managed, so the page is rendered per request rather than
// baked at build time. Swap to a revalidate window once traffic justifies it.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [show, shows, stats, winner, episodes, gallery] = await Promise.all([
    getCurrentShow(),
    getShows(),
    getStats(),
    getLatestWinner(),
    getEpisodes(),
    getGallery(),
  ]);

  // The watch cells label each video with its show. Resolving the title here
  // keeps the grid a presentation component with no query of its own.
  const showTitles = Object.fromEntries(shows.map((s) => [s.slug, s.title]));

  // The header and the hero card must agree, so the label is derived once.
  const statusLabel =
    show && (show.status === "OPEN" || show.status === "LIVE") ? "Entries open" : "Entries closed";

  return (
    <>
      {/* Organization markup, so search engines resolve the brand and its real
          social profiles rather than guessing. */}
      <script {...jsonLdScriptProps(organizationJsonLd())} />

      <Hero show={show} winner={winner} statusLabel={statusLabel} />
      <Ticker />
      <StatsBand stats={stats} />
      <HowItWorks />
      <WinnerSpotlight winner={winner} />
      <ClipReel />
      <WatchGrid episodes={episodes} showTitles={showTitles} />
      <GalleryMarquee images={gallery} />
      <NewsletterPoster />
    </>
  );
}
