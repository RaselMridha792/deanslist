import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  SHOWS,
  WINNERS,
  EPISODES,
  STATS,
  GALLERY,
  SITE,
} from "../src/content/site";

/**
 * Writes the content harvested from the old site into the database.
 *
 * src/content/site.ts is the single source of truth: this seeds from it, and
 * src/lib/queries.ts falls back to it when a table is empty. So the pre-seed
 * site and the dashboard-managed one can never drift apart in wording.
 *
 * Idempotent — every write is an upsert keyed on a natural unique column, so
 * running it twice changes nothing and running it after the client has edited
 * content in the dashboard does not clobber their edits with `update: {}`.
 */

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@deanslist.live";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Site Owner",
      role: "OWNER",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  return { user, email, password };
}

async function seedShows() {
  for (const s of SHOWS) {
    await prisma.show.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        title: s.title,
        tagline: s.tagline,
        description: s.description,
        prizeAmount: s.prizeAmount,
        // Deliberately null. The old homepage says "Show Starts August 11" while
        // its own winner story is dated August 28; neither is safe to publish.
        // The countdown appears as soon as the client sets a real date.
        entryDeadline: s.entryDeadline ? new Date(s.entryDeadline) : null,
        startsAt: s.startsAt ? new Date(s.startsAt) : null,
        status: s.status,
        heroImageUrl: s.keyArt,
        trailerUrl: s.heroVideo,
      },
    });
  }
  return SHOWS.length;
}

async function seedWinners() {
  for (const w of WINNERS) {
    const show = await prisma.show.findUnique({ where: { slug: w.showSlug } });
    await prisma.winner.upsert({
      where: { slug: w.slug },
      update: {},
      create: {
        slug: w.slug,
        name: w.name,
        showId: show?.id,
        prizeAwarded: w.prizeAwarded,
        story: w.story,
        // The old winner page carries no photograph of the winner, only the site
        // logo. Nothing is substituted; the UI renders an initial.
        photoUrl: w.photoUrl,
        videoUrl: w.videoUrl,
        announcedAt: w.announcedAt ? new Date(w.announcedAt) : null,
      },
    });
  }
  return WINNERS.length;
}

async function seedEpisodes() {
  let n = 0;
  for (const e of EPISODES) {
    const show = await prisma.show.findUnique({ where: { slug: e.showSlug } });
    const videoUrl = `https://www.youtube.com/watch?v=${e.videoId}`;

    // Episode has no natural unique column, so guard on the video url instead of
    // upserting — otherwise re-running duplicates every row.
    const existing = await prisma.episode.findFirst({ where: { videoUrl } });
    if (existing) continue;

    await prisma.episode.create({
      data: {
        showId: show!.id,
        title: e.title,
        videoUrl,
        thumbnail: `https://i.ytimg.com/vi/${e.videoId}/hqdefault.jpg`,
      },
    });
    n++;
  }
  return n;
}

async function seedStats() {
  for (const [i, s] of STATS.entries()) {
    await prisma.siteStat.upsert({
      where: { key: s.key },
      update: {},
      create: {
        key: s.key,
        label: s.label,
        value: s.value,
        prefix: s.prefix ?? null,
        suffix: s.suffix ?? null,
        // Only verified figures ever reach the public site. The 700K subscriber
        // claim is unconfirmed — the old site's own counter renders ".7Mil+" —
        // so it seeds inactive and stays invisible until the client confirms it
        // in the dashboard.
        verified: s.verified,
        active: true,
        sortOrder: i,
      },
    });
  }
  return STATS.filter((s) => s.verified).length;
}

async function seedGallery() {
  const show = await prisma.show.findUnique({ where: { slug: "crown-the-sound" } });
  let n = 0;
  for (const [i, g] of GALLERY.entries()) {
    const existing = await prisma.galleryImage.findFirst({ where: { url: g.url } });
    if (existing) continue;
    await prisma.galleryImage.create({
      data: { url: g.url, alt: g.alt, showId: show?.id, sortOrder: i },
    });
    n++;
  }
  return n;
}

/**
 * Seeds the chatbot knowledge base with only what the old site actually states.
 * The assistant answers from these rows and nothing else, so an unverified fact
 * here becomes an unverified fact told to a contestant.
 */
async function seedKnowledge() {
  const items = [
    {
      question: "What is the Dean's List?",
      answer:
        "A global online talent competition. Contestants perform from home, the audience votes live across YouTube and Facebook, and the winner takes a cash prize and a place on the Principal's Roll.",
      category: "general",
    },
    {
      question: "What is Drop That Mike?",
      answer:
        "A show where the audience controls the prize. The pot drains in real time and viewers vote Freeze to lock it or Pass to eliminate the performer.",
      category: "shows",
    },
    {
      question: "What is Crown the Sound?",
      answer:
        "Contestants perform an assigned song and the audience votes. Judges weigh creativity, stage presence and originality across the season.",
      category: "shows",
    },
    {
      question: "How do I enter?",
      answer:
        "Use the entry form on the site. You need your contact details, your talent category, and a public link to a performance video.",
      category: "entry",
    },
    {
      question: "Does it cost anything to enter?",
      answer:
        "That is confirmed in the official contest rules. Please check the Rules page or email the team.",
      category: "entry",
    },
    {
      question: "How do I contact the team?",
      answer: `Email ${SITE.email}. The team reads everything and replies directly.`,
      category: "contact",
    },
    {
      question: "When is the next show?",
      answer:
        "Dates are announced on the official YouTube and Facebook channels, and to the email list first. I do not have a confirmed date to give you.",
      category: "shows",
    },
  ];

  let n = 0;
  for (const item of items) {
    const existing = await prisma.knowledgeItem.findFirst({
      where: { question: item.question },
    });
    if (existing) continue;
    await prisma.knowledgeItem.create({ data: { ...item, active: true } });
    n++;
  }
  return n;
}

async function main() {
  const { email, password } = await seedAdmin();
  const shows = await seedShows();
  const winners = await seedWinners();
  const episodes = await seedEpisodes();
  const stats = await seedStats();
  const gallery = await seedGallery();
  const knowledge = await seedKnowledge();

  console.log(`
  shows          ${shows}
  winners        ${winners}
  episodes       ${episodes}
  gallery        ${gallery}
  stats          ${stats} verified of ${STATS.length} (unverified stay hidden)
  knowledge      ${knowledge}

  Admin login    ${email} / ${password}
  Change that password immediately, or set SEED_ADMIN_PASSWORD before seeding.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
