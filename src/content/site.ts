/**
 * Verified content lifted from the old Joomla site on 2026-09-04, plus the
 * structure the rebuild needs around it.
 *
 * This is the single source of truth in two directions:
 *   - prisma/seed.ts writes it into the database
 *   - src/lib/queries.ts falls back to it when the database is empty or absent
 *
 * so the site renders real content today and switches to dashboard-managed
 * content the moment a row exists, with no copy drift between the two.
 *
 * RULE: never invent a contest fact. Dates, prize amounts, winner names and
 * audience figures are the client's to confirm. Anything unconfirmed carries
 * `pending: true` or `verified: false` and the UI must handle its absence
 * gracefully rather than printing a placeholder to the public.
 * Open questions are listed in docs/PROJECT-BRIEF.md section 8.
 */

export const SITE = {
  name: "The Dean's List",
  legalName: "Dean's List LTD",
  tagline: "Any talent. Big cash. Live from home.",
  description:
    "A global online talent competition. Perform from home, get voted on live, and win a cash prize and a place on the Principal's Roll.",
  email: "deanslistltd@gmail.com",
  location: "Charleston, WV",
  socials: {
    youtube: "https://www.youtube.com/@DeansList2025",
    facebook: "https://www.facebook.com/Deanslistltd2025",
  },
} as const;

/* ------------------------------------------------------------------ shows */

export type ShowSeed = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  /** null until the client confirms. The UI must not print a guessed date. */
  entryDeadline: string | null;
  startsAt: string | null;
  /** Cadence copy taken verbatim from the old site. */
  cadence: string | null;
  prizeAmount: number | null;
  status: "OPEN" | "LIVE" | "CLOSED" | "DRAFT";
  heroVideo: string;
  heroPoster: string;
  keyArt: string;
  mechanic?: { name: string; body: string }[];
  pending?: string[];
};

export const SHOWS: ShowSeed[] = [
  {
    slug: "drop-that-mike",
    title: "Drop That Mike",
    tagline: "The only show where you control the cash.",
    description:
      "This is not just another talent show. On Drop That Mike, YOU decide who stays and who gets eliminated. The prize pool drains in real time, and the only thing standing between the money and zero is the audience. Perform from home. Compete for real cash. Every talent is welcome.",
    entryDeadline: null,
    startsAt: null,
    cadence: "Every Tuesday",
    prizeAmount: null,
    status: "OPEN",
    heroVideo: "/media/hero/mic",
    heroPoster: "/media/hero/mic.jpg",
    keyArt: "/media/shows/drop-that-mike-key-art",
    mechanic: [
      {
        name: "Freeze",
        body: "Lock the pot where it stands. The contestant survives the round and the prize money stops draining.",
      },
      {
        name: "Pass",
        body: "Send them home. The pot keeps falling and the next performer steps up against a smaller prize.",
      },
    ],
    // Old site says "Show starts August 11" on the homepage while the winner
    // story is dated August 28. Neither is safe to publish. See SITE-AUDIT.md §7.
    pending: ["Next show date", "Entry deadline", "Prize pool for this season"],
  },
  {
    slug: "crown-the-sound",
    title: "Crown the Sound",
    tagline: "One song. One stage. One crown.",
    description:
      "Contestants perform an assigned song and the audience votes. Judges weigh creativity, stage presence and originality across the season. The winner takes a cash prize and a place on the Principal's Roll.",
    entryDeadline: null,
    startsAt: null,
    cadence: null,
    prizeAmount: 1000,
    status: "CLOSED",
    heroVideo: "/media/promo/what-is-it",
    heroPoster: "/media/promo/what-is-it.jpg",
    keyArt: "/media/shows/crown-the-sound-4",
    pending: ["Next season dates"],
  },
];

/* ---------------------------------------------------------------- winners */

export type WinnerSeed = {
  slug: string;
  name: string;
  showSlug: string;
  prizeAwarded: number | null;
  story: string;
  photoUrl: string | null;
  videoUrl: string | null;
  announcedAt: string | null;
  /** Set when the underlying fact is still awaiting client confirmation. */
  unconfirmed?: string;
};

export const WINNERS: WinnerSeed[] = [
  {
    slug: "pj-galloway",
    name: "PJ Galloway",
    showSlug: "crown-the-sound",
    prizeAwarded: 1000,
    story:
      "Talent, passion and voice set this performance apart. It captured the audience and the judges alike, and proved what happens when preparation meets opportunity — the Dean's List stage welcomes performers at every level of experience.",
    photoUrl: "/media/gallery/cts-01",
    videoUrl: null,
    announcedAt: null,
    // The old homepage names PJ Galloway; its own winners page names Ekwelem
    // Precious (Sophia) for the same challenge. Carried forward on the client's
    // instruction, but still unconfirmed. See SITE-AUDIT.md §7.
    unconfirmed:
      "The old site names two different winners for this challenge. Confirm before this goes public.",
  },
];

/* --------------------------------------------------------------- episodes */

/** YouTube ids embedded on the old site, confirmed present in its markup. */
export const EPISODES = [
  { videoId: "NFh5taSg_84", title: "Drop That Mike — the format", showSlug: "drop-that-mike" },
  { videoId: "CesbWtmVFhk", title: "Crown the Sound — highlights", showSlug: "crown-the-sound" },
  { videoId: "HFz3r0V1uag", title: "Crown the Sound — performances", showSlug: "crown-the-sound" },
  { videoId: "PusRA6BfZOk", title: "On the Dean's List stage", showSlug: "crown-the-sound" },
  { videoId: "hwHebUj7VHs", title: "Behind the judges' table", showSlug: "crown-the-sound" },
  { videoId: "xbpJOjiUnaY", title: "Season moments", showSlug: "crown-the-sound" },
] as const;

/* ------------------------------------------------------------------ stats */

/**
 * The old site renders ".7Mil+" and a bare "K" because its counter animates from
 * an empty value. Nothing here reaches the public until `verified` is true —
 * a missing number is far better than a broken one.
 */
export type StatSeed = {
  key: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  /** Nothing reaches the public site until the client confirms the figure. */
  verified: boolean;
  note: string;
};

export const STATS: StatSeed[] = [
  {
    key: "youtube_subscribers",
    label: "YouTube subscribers",
    value: 700_000,
    suffix: "+",
    verified: false,
    note: "Proposal claims 700K+. The old site's own counter is broken, so this is unconfirmed.",
  },
  {
    key: "facebook_followers",
    label: "Facebook followers",
    value: 0,
    suffix: "+",
    verified: false,
    note: "Old site renders a bare 'K' with no number.",
  },
  {
    key: "prize_awarded",
    label: "Prize awarded",
    value: 1000,
    prefix: "$",
    verified: true,
    note: "Stated on the Crown the Sound winner page.",
  },
];

/* ---------------------------------------------------------------- gallery */

export const GALLERY = [
  { url: "/media/gallery/cts-01", alt: "Crown the Sound performance" },
  { url: "/media/gallery/cts-02", alt: "Contestant on stage" },
  { url: "/media/gallery/cts-03", alt: "Live audience moment" },
  { url: "/media/gallery/cts-04", alt: "Judges during the show" },
  { url: "/media/gallery/cts-05", alt: "Winner announcement" },
  { url: "/media/gallery/social-01", alt: "Dean's List promotional still" },
] as const;

/* ------------------------------------------------------- talent categories */

/**
 * Each maps to a transcoded clip from the old site. These were the .mov files
 * no browser could play; they are now MP4 + WebM with a poster frame.
 */
export const TALENT_CATEGORIES = [
  { value: "Singing", label: "Singing", clip: "/media/texture/vocals" },
  { value: "Rap", label: "Rap", clip: "/media/texture/rap" },
  { value: "Instrument", label: "Instrument", clip: "/media/texture/keys" },
  { value: "Drums", label: "Drums", clip: "/media/texture/drums" },
  { value: "Bass", label: "Bass", clip: "/media/texture/bass" },
  { value: "Production", label: "Production / DJ", clip: "/media/texture/deck" },
  { value: "Dance", label: "Dance", clip: "/media/texture/singer-f" },
  { value: "Other", label: "Something else", clip: "/media/texture/singer-m" },
] as const;

/* -------------------------------------------------------------- how it works */

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Enter",
    body: "Send your details and a link to your performance. Every entry is reviewed by the team.",
  },
  {
    step: "02",
    title: "Perform",
    body: "Compete from wherever you are. No travel, no venue, no gatekeeping — just the performance.",
  },
  {
    step: "03",
    title: "Get voted",
    body: "The audience decides live across YouTube and Facebook. On Drop That Mike they control the prize pool itself.",
  },
  {
    step: "04",
    title: "Make the list",
    body: "Win the cash prize and take a place on the Principal's Roll of the Dean's List.",
  },
] as const;

/* ------------------------------------------------------- contact routing */

export const INQUIRY_TYPES = [
  { value: "GENERAL", label: "General enquiry" },
  { value: "PRESS", label: "Press & media" },
  { value: "SPONSOR", label: "Sponsorship" },
  { value: "CONTESTANT", label: "Contest support" },
] as const;

export const SPONSOR_TIERS = [
  {
    name: "Headline",
    body: "Naming presence across a full season, on-stream mentions, logo on the key art, and a dedicated segment.",
  },
  {
    name: "Supporting",
    body: "Logo placement across episodes and the site, plus social credits through the season.",
  },
  {
    name: "Partner",
    body: "Product or prize partnership with credits on the show and the winner announcement.",
  },
] as const;
