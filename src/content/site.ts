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
    // The old winner page carries no photograph of the winner at all, only the
    // site logo. Substituting a gallery shot would publish an unidentified
    // person's likeness under this name. The UI renders an initial instead.
    photoUrl: null,
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

/**
 * The old site linked 5 of these 20 event photographs. The rest were on the
 * server and had never been published — see docs/SITE-AUDIT.md.
 *
 * Alt text is deliberately generic: nobody in these photographs is identified
 * anywhere on the old site, so naming them would be a guess.
 */
export const GALLERY = [
  { url: "/media/gallery/cts-01", alt: "A performance on the Crown the Sound stage" },
  { url: "/media/gallery/cts-02", alt: "Contestant mid-performance" },
  { url: "/media/gallery/cts-03", alt: "The crowd during a live round" },
  { url: "/media/gallery/cts-04", alt: "Performing to the room" },
  { url: "/media/gallery/cts-05", alt: "A moment from the season" },
  { url: "/media/gallery/cts-06", alt: "Backstage before a set" },
  { url: "/media/gallery/cts-07", alt: "On stage under the lights" },
  { url: "/media/gallery/cts-08", alt: "The audience watching a performance" },
  { url: "/media/gallery/cts-09", alt: "A contestant taking the stage" },
  { url: "/media/gallery/cts-10", alt: "Mid-set on the Dean's List stage" },
  { url: "/media/gallery/cts-11", alt: "The room during a live show" },
  { url: "/media/gallery/cts-12", alt: "A performance in full flow" },
  { url: "/media/gallery/cts-13", alt: "Judges watching a round" },
  { url: "/media/gallery/cts-14", alt: "The stage between performances" },
  { url: "/media/gallery/cts-15", alt: "A contestant and the crowd" },
  { url: "/media/gallery/cts-16", alt: "Lights on the Crown the Sound stage" },
  { url: "/media/gallery/cts-17", alt: "A performance moment" },
  { url: "/media/gallery/cts-18", alt: "Applause after a set" },
  { url: "/media/gallery/cts-19", alt: "The room at full capacity" },
  { url: "/media/gallery/cts-20", alt: "Closing out a round" },
  { url: "/media/gallery/social-01", alt: "Dean's List promotional still" },
  { url: "/media/gallery/social-02", alt: "Dean's List promotional still" },
] as const;

/* ------------------------------------------------------- talent categories */

/**
 * Taken verbatim from the client's own entry forms (MachForm 88574 and 95824),
 * not invented. Chef and Fitness/Athlete are on their list, which is the proof
 * that "Any talent. Big cash." is meant literally and this is not a music-only
 * competition — an assumption that would have quietly narrowed the funnel.
 *
 * `clip` maps to a transcoded background loop where one fits. These were the
 * .mov files no browser could play; they are now MP4 + WebM with a poster.
 */
export const TALENT_CATEGORIES = [
  { value: "Singer", label: "Singer", clip: "/media/texture/vocals" },
  { value: "Song Writer", label: "Song writer", clip: "/media/texture/singer-f" },
  { value: "Musician", label: "Musician", clip: "/media/texture/keys" },
  { value: "DJ", label: "DJ", clip: "/media/texture/deck" },
  { value: "Rapper", label: "Rapper", clip: "/media/texture/rap" },
  { value: "Chef", label: "Chef", clip: null },
  { value: "Fitness/Athlete", label: "Fitness / athlete", clip: null },
  { value: "Other", label: "Something else", clip: "/media/texture/singer-m" },
] as const;

/**
 * What the old /videos page tells people they will find on the channel.
 * Copy is theirs; keeping it means the rebuild does not quietly drop a section.
 */
export const CHANNEL_CONTENT = [
  {
    title: "Full performances",
    body: "Relive the artistry and talent of each contestant as they take the stage.",
  },
  {
    title: "Highlights & clips",
    body: "Quick recaps and powerful moments you won't want to miss.",
  },
  {
    title: "Winner spotlights",
    body: "Celebrate each season's champion and their journey to the Principal's Roll.",
  },
  {
    title: "Behind the scenes",
    body: "See how contestants prepare and perform at a competitive level.",
  },
] as const;

export const WHY_SUBSCRIBE =
  "Discover new talent, witness incredible performances, and support artists from across the globe. Every video is another opportunity to be inspired by creativity and excellence.";

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
