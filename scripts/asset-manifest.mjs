/**
 * Everything worth taking off the old Joomla site, and what it becomes.
 *
 * Inventory taken 2026-09-04 by crawling the six URLs in the old sitemap.
 * Sizes are the measured originals — see docs/SITE-AUDIT.md.
 *
 * `role` drives how each asset is processed:
 *   hero     — full-bleed background video, gets the tightest bitrate budget
 *   texture  — short looping clip used as a decorative tile
 *   promo    — a real promo film, kept at higher quality
 *   photo    — winner/event photography
 *   brand    — logo and favicon, kept lossless where it matters
 */

export const ORIGIN = "https://deanslist.live";

export const IMAGES = [
  { path: "/images/deanslist_logowhite-red.fw.png", out: "brand/logo", role: "brand" },
  { path: "/images/newfavicon.fw.png", out: "brand/favicon-source", role: "brand" },

  // Crown the Sound key art — the five multi-megabyte Fireworks PNGs
  { path: "/images/2025/08/26/cs1.fw.png", out: "shows/crown-the-sound-1", role: "photo" },
  { path: "/images/2025/08/26/cs3.fw.png", out: "shows/crown-the-sound-3", role: "photo" },
  { path: "/images/2025/08/26/cs4.fw.png", out: "shows/crown-the-sound-4", role: "photo" },
  { path: "/images/2025/08/26/cs6.fw.png", out: "shows/crown-the-sound-6", role: "photo" },
  { path: "/images/2025/08/26/cs7.fw.png", out: "shows/crown-the-sound-7", role: "photo" },

  // Event photography. The old site links only 5 of these; the other 15 were
  // found by probing the directory (listing is 403) and had never been used.
  { path: "/images/cts-hbd/img_4141.jpg", out: "gallery/cts-01", role: "photo" },
  { path: "/images/cts-hbd/img_4142.jpg", out: "gallery/cts-02", role: "photo" },
  { path: "/images/cts-hbd/img_4169.jpg", out: "gallery/cts-03", role: "photo" },
  { path: "/images/cts-hbd/img_4170.jpg", out: "gallery/cts-04", role: "photo" },
  { path: "/images/cts-hbd/img_4171.jpg", out: "gallery/cts-05", role: "photo" },
  { path: "/images/cts-hbd/img_4172.jpg", out: "gallery/cts-06", role: "photo" },
  { path: "/images/cts-hbd/img_4173.jpg", out: "gallery/cts-07", role: "photo" },
  { path: "/images/cts-hbd/img_4174.jpg", out: "gallery/cts-08", role: "photo" },
  { path: "/images/cts-hbd/img_4175.jpg", out: "gallery/cts-09", role: "photo" },
  { path: "/images/cts-hbd/img_4176.jpg", out: "gallery/cts-10", role: "photo" },
  { path: "/images/cts-hbd/img_4178.jpg", out: "gallery/cts-11", role: "photo" },
  { path: "/images/cts-hbd/img_4179.jpg", out: "gallery/cts-12", role: "photo" },
  { path: "/images/cts-hbd/img_4187.jpg", out: "gallery/cts-13", role: "photo" },
  { path: "/images/cts-hbd/img_4188.jpg", out: "gallery/cts-14", role: "photo" },
  { path: "/images/cts-hbd/img_4189.jpg", out: "gallery/cts-15", role: "photo" },
  { path: "/images/cts-hbd/img_4190.jpg", out: "gallery/cts-16", role: "photo" },
  { path: "/images/cts-hbd/img_4191.jpg", out: "gallery/cts-17", role: "photo" },
  { path: "/images/cts-hbd/img_4196.jpg", out: "gallery/cts-18", role: "photo" },
  { path: "/images/cts-hbd/img_4197.jpg", out: "gallery/cts-19", role: "photo" },
  { path: "/images/cts-hbd/img_4198.jpg", out: "gallery/cts-20", role: "photo" },

  // Social-sourced stills
  {
    path: "/images/2025/08/26/489850750_1275747080576942_5687792590632032606_n.jpg",
    out: "gallery/social-01",
    role: "photo",
  },
  {
    path: "/images/2025/08/26/515437850_1358196485665334_531242844971902180_n.jpg",
    out: "gallery/social-02",
    role: "photo",
  },
  {
    path: "/images/2026/07/25/731078648_1635501401268173_9208916630859175474_n.jpg",
    out: "shows/drop-that-mike-key-art",
    role: "photo",
  },

  // Missed by the first pass, which read only `src`. These appear in other
  // attributes and inline background styles.
  { path: "/images/2026/07/25/mikedrop.jpg", out: "shows/drop-that-mike-alt", role: "photo" },
  { path: "/images/2017/06/14/1.jpg", out: "gallery/archive-2017", role: "photo" },
];

export const VIDEOS = [
  // Playable today
  { path: "/media/videos/2025/08/26/mic3.mp4", out: "hero/mic", role: "hero" },
  { path: "/media/videos/2025/08/26/mic.mp4", out: "hero/mic-alt", role: "hero" },
  { path: "/media/videos/2026/07/25/dropmike-video1-2026.mp4", out: "promo/drop-that-mike-1", role: "promo" },
  { path: "/media/videos/2026/07/25/dropmike-video2-2026.mp4", out: "promo/drop-that-mike-2", role: "promo" },
  { path: "/media/videos/2025/08/27/envato_video_gen_jul_14_2025_0_38_03.mp4", out: "texture/stage", role: "texture" },

  // QuickTime — currently downloaded by every visitor and rendered by none.
  // These are the talent-category tiles, so they matter to the design.
  { path: "/media/videos/2025/08/26/voc-1.mov", out: "texture/vocals", role: "texture" },
  { path: "/media/videos/2025/08/26/guy.mov", out: "texture/singer-m", role: "texture" },
  { path: "/media/videos/2025/08/26/girl.mov", out: "texture/singer-f", role: "texture" },
  { path: "/media/videos/2025/08/26/rap.mov", out: "texture/rap", role: "texture" },
  { path: "/media/videos/2025/08/26/drum.mov", out: "texture/drums", role: "texture" },
  { path: "/media/videos/2025/08/26/bass.mov", out: "texture/bass", role: "texture" },
  { path: "/media/videos/2025/08/26/key.mov", out: "texture/keys", role: "texture" },
  { path: "/media/videos/2025/08/26/board.mov", out: "texture/deck", role: "texture" },
  { path: "/media/videos/2025/08/27/judges.mov", out: "promo/judges", role: "promo" },
  { path: "/media/videos/2025/08/27/what2.mov", out: "promo/what-is-it", role: "promo" },
  { path: "/media/videos/2025/08/27/youtube1.mov", out: "promo/youtube-1", role: "promo" },
  { path: "/media/videos/2025/08/27/youtube4.mov", out: "promo/youtube-4", role: "promo" },
];

/**
 * Embeds found on the old site. Not downloaded — referenced by id.
 * These seed the Episode table so /watch has real content on day one.
 */
export const YOUTUBE_IDS = [
  "NFh5taSg_84",
  "CesbWtmVFhk",
  "HFz3r0V1uag",
  "PusRA6BfZOk",
  "hwHebUj7VHs",
  "xbpJOjiUnaY",
];

export const FACEBOOK_VIDEOS = [
  { type: "video", id: "2839942476361583" },
  { type: "video", id: "1929791601140644" },
  { type: "reel", id: "2271520033316942" },
  { type: "reel", id: "1493300352021808" },
  { type: "reel", id: "2527716030997568" },
];

/** Output budgets, in bytes. The pipeline warns when an asset exceeds its role budget. */
export const BUDGETS = {
  hero: 2_000_000,
  promo: 3_000_000,
  texture: 900_000,
  photo: 300_000,
  brand: 120_000,
  poster: 120_000,
};
