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
  /**
   * Supplied by the client — see session.md. Supersedes the gmail address the
   * old site publishes.
   *
   * It is not only a tidiness question: campaign mail has to be sent from the
   * client's own domain for DMARC to align, and a gmail.com sender for
   * deanslist.live fails that check and lands in spam.
   */
  email: "producer@deanslist.live",
  location: "South Charleston, WV",

  /**
   * Full postal address. Load-bearing rather than decorative: CAN-SPAM requires
   * a physical postal address in every marketing email, so the campaign
   * templates need somewhere to read one from.
   */
  address: {
    line1: "5619 1/2 SW MacCorkle Avenue",
    city: "South Charleston",
    state: "WV",
    postalCode: "25309",
    country: "USA",
  },

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
  /** The client's own pitch copy, kept verbatim. */
  pitch?: string[];
  pending?: string[];
};

export const SHOWS: ShowSeed[] = [
  {
    slug: "drop-that-mike",
    title: "Drop That Mike",
    tagline: "The only show where you control the cash.",
    description:
      "This is not just another talent show. On Drop That Mike, YOU decide who stays and who gets eliminated with Freeze or Pass. Perform from home. Compete for real cash. Every talent is welcome.",
    /** Verbatim from the old homepage. The client's own words about their own format. */
    pitch: [
      "DROP THAT MIKE — the only show where YOU control the cash!",
      "The prize pool is DRAINING in real time… and the only thing standing between the money and zero is YOU. Hit FREEZE to lock the pot and save the performer's payday!",
      "The better they perform, the harder you fight to keep that money alive.",
      "Tune in LIVE — drop a comment if you're ready to FREEZE!",
    ],
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
      "On August 28th, the latest Crown the Sound challenge brought incredible energy as contestants from around the world submitted video entries to perform the classic song “Happy Birthday.” With votes pouring in from viewers across the globe, one standout talent rose above the rest. Congratulations to PJ Galloway, the winner of this season's challenge, whose performance captured both the creativity of the contest and the hearts of the audience.",
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
  {
    slug: "ekwelem-precious-sophia",
    name: "Ekwelem Precious (Sophia)",
    showSlug: "crown-the-sound",
    prizeAwarded: 1000,
    story:
      "Winner of a Crown the Sound contest and recipient of the $1,000 cash prize. Sophia's talent, passion, and voice truly set her apart. Her performance captured the hearts of the audience and the judges, showcasing exactly what the Dean's List stands for — excellence, artistry, and authenticity. Sophia's journey is a testament to what happens when preparation meets opportunity. Whether you've been performing for years or are just finding your voice, her story proves that this platform is open to all who are ready to be heard.",
    photoUrl: null,
    videoUrl: null,
    announcedAt: null,
    // Kept because it is the client's own published copy, on their own winners
    // page, about a named person. The conflict is which of the two is the most
    // recent: the homepage credits PJ Galloway with "the latest" challenge and
    // this page credits Sophia with "the most recent" one. Both cannot be true.
    // Published on the client's instruction to lead with PJ Galloway; the
    // ordering is theirs to confirm.
    unconfirmed:
      "The winners page calls this the most recent contest while the homepage says the same of PJ Galloway. Confirm the order and the dates.",
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
    value: 1_700_000,
    suffix: "+",
    verified: false,
    note:
      "The old site's counter animates to 1.7Mil+ — a static fetch catches it mid-count, " +
      "which is why an earlier pass read it as a broken '.7Mil+'. It is the client's own " +
      "published figure, and it is 2.4x what the proposal claims (700K+). Shown to sponsors " +
      "it becomes an advertising claim, so it stays hidden until someone confirms it against " +
      "the channel.",
  },
  {
    key: "facebook_followers",
    label: "Facebook followers",
    value: 208_000,
    suffix: "+",
    verified: false,
    note: "Old site's counter animates to 208K. Client's own figure, unconfirmed.",
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

/* -------------------------------------------------- long-form page copy */

/**
 * The client's own prose, kept verbatim from the old site.
 *
 * An earlier pass captured these pages with `curl`, which returns the markup
 * before SP Page Builder has run — so several sections came back as a summary
 * or not at all. Re-captured with a real browser, and this is what they
 * actually say. Rewriting it would be a content decision nobody asked for.
 *
 * Editable from the dashboard once a PageSection row exists for the same key;
 * these are the fallbacks.
 */

export const ABOUT_COPY = [
  "The Dean's List is more than just a name — it is a platform created to celebrate excellence and showcase worldwide musical talent. Designed as a stage where creativity meets recognition, The Dean's List invites contestants from around the globe to step forward and demonstrate their artistry. Contestants bring their wit, their creativity, and their presence to the stage as they compete for recognition that will set them apart in the music world.",
  "Each performance becomes part of the experience, highlighting the diversity of style, skill, and originality that exists in music today. The Dean's List not only honors performers for their ability, but also gives them the chance to inspire others and gain exposure in front of audiences who are searching for fresh, standout talent.",
  "Every season builds anticipation as musicians bring their very best in pursuit of the ultimate prize. At the end of each season, the winner earns more than just applause — they secure a cash prize and, even more importantly, a coveted place on the Principal's Roll of the Dean's List. This honor cements their status as one of the standout talents in the world, ensuring their name is forever connected with excellence, creativity, and achievement.",
  "By combining recognition, reward, and the thrill of competition, The Dean's List continues to grow as the premier platform for celebrating the best in worldwide musical talent.",
] as const;

export const WATCH_COPY = [
  "The Dean's List isn't just a platform — it's an experience. Through our official YouTube channel, you can watch performances, highlights, and behind-the-scenes moments that bring the competition to life. Each video showcases the creativity, presence, and excellence that contestants bring to the stage season after season.",
  "Our videos make it easy for fans, music lovers, and industry professionals to stay connected with the journey of our contestants. From electrifying live performances to exclusive interviews and recaps, the Dean's List channel captures every step of the competition.",
] as const;

export const WATCH_OUTRO =
  "Join the conversation, share your favourite performances, and help us celebrate worldwide musical talent with the power of video.";

/** Opens the winners archive. Their words about why the contest exists. */
export const WINNERS_INTRO =
  "The Crown the Sound contest is a cornerstone of the Dean's List platform, designed to spotlight exceptional musical talent and reward artists who bring creativity, presence, and skill to the stage. Every season, one standout performer rises above the rest, earning the coveted title, the prize, and a place among our past winners.";

/**
 * Closes the winners archive. Note the "$1,000" — it is the client's own
 * published figure for this contest, corroborated by the winner page, so it is
 * a stated fact rather than an invented one.
 */
export const NEXT_WINNER_COPY = {
  heading: "Want to be the next winner?",
  body: [
    "If you missed your shot this time, don't worry — another chance to win $1,000 is coming soon. This is more than just a contest; it's your moment to be recognised, celebrated, and remembered.",
    "Whether you're a seasoned performer or a new artist ready to take the stage, this is your opportunity to showcase your talent to the world.",
    "Follow us on all platforms and stay locked in for updates on the next Crown the Sound competition. You could be next.",
  ],
} as const;
