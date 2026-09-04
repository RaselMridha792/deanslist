import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },

  /**
   * Redirects from the old Joomla URLs.
   *
   * Not guessed: /sitemap.xml on the old site lists exactly seven URLs, so this
   * is the complete set. Every one is a 301 so the ranking transfers rather than
   * being treated as temporary.
   *
   * The mapping for join-the-dean-team is worth stating plainly. The proposal
   * describes that page as a crew and judges funnel, but the live page embeds
   * MachForm 88574 titled "Join Dean's List Talent Pool" and does not mention
   * crew, judges or hosts once. So its traffic is people offering their talent,
   * and /join leads with the talent pool for exactly that reason.
   */
  async redirects() {
    return [
      { source: "/index.php", destination: "/", permanent: true },
      {
        source: "/index.php/what-is-the-deans-list",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/index.php/join-the-dean-team",
        destination: "/join",
        permanent: true,
      },
      {
        source: "/index.php/upcoming-events/deans-list-drop-that-mike-challenge",
        destination: "/shows/drop-that-mike",
        permanent: true,
      },
      {
        source: "/index.php/past-challenges/1st-crown-the-sound-winner",
        destination: "/winners/pj-galloway",
        permanent: true,
      },
      { source: "/index.php/videos", destination: "/watch", permanent: true },

      // Catch-alls for anything else Joomla served under these prefixes.
      {
        source: "/index.php/upcoming-events/:path*",
        destination: "/shows",
        permanent: true,
      },
      {
        source: "/index.php/past-challenges/:path*",
        destination: "/winners",
        permanent: true,
      },
      { source: "/index.php/:path*", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
