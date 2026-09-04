"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";
import { extractYouTubeId } from "@/lib/queries";
import type { ActionResult } from "@/components/admin/crud";

/**
 * Mutations for shows and their episodes.
 *
 * Same two rules as the leads actions, for the same reasons:
 *
 *   every action re-checks the session itself. A server action is a public HTTP
 *   endpoint with a generated name; being reachable only from a page behind a
 *   login is not authorisation, and middleware has been bypassable before
 *   (CVE-2025-29927). EDITOR writes content, OWNER deletes it.
 *
 *   every action writes an AuditLog row. A show going LIVE changes the homepage
 *   for every visitor, so "who published this and when" has to have an answer.
 *
 * ---------------------------------------------------------------- timezones
 *
 * A `datetime-local` input submits "2026-08-11T20:00" — a wall clock with no
 * zone attached. Feeding that straight to `new Date()` on the server resolves it
 * in the *server's* zone: the developer's zone in dev, UTC on the VPS. The same
 * form would then store two different instants depending on where it ran, and
 * the homepage countdown is computed from that instant.
 *
 * So the zone is never inferred. The form posts the IANA zone its fields were
 * rendered and labelled in, and `parseWhen` resolves the wall clock in that zone
 * using the offset in force at that instant — which is what keeps a time entered
 * either side of a daylight-saving switch on the hour the admin typed.
 */

/* ------------------------------------------------------------------ shared */

/** Charleston, WV. Assumption, not a contest fact — every form can override it. */
const DEFAULT_TZ = "America/New_York";

const SHOW_STATUSES = ["DRAFT", "OPEN", "LIVE", "CLOSED", "ARCHIVED"] as const;

const SLUG_RE = /^[a-z0-9-]+$/;

type Ok<T> = { ok: true; value: T };
type Fail = { ok: false; error: string };

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the form and try again.";
}

async function audit(
  user: SessionUser,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userEmail: user.email,
      action,
      entityType,
      entityId,
      before: before as never,
      after: after as never,
    },
  });
}

/**
 * Everything a show can change on the public site. The homepage hero reads
 * getCurrentShow(), /shows lists them, /shows/[slug] renders one, and /watch is
 * built from their episodes — so all four are stale the moment a show is saved.
 */
function revalidatePublic() {
  revalidatePath("/");
  revalidatePath("/shows");
  revalidatePath("/shows/[slug]", "page");
  revalidatePath("/watch");
  revalidatePath("/admin/shows");
}

/* ---------------------------------------------------------------- timezone */

function isValidZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset of `timeZone` from UTC, in milliseconds, at one specific instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  // The formatted parts carry no milliseconds, so compare against a floored instant.
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}

/**
 * "2026-08-11T20:00" in `timeZone` -> the instant it names.
 *
 * Solved rather than looked up: the offset depends on the instant, and the
 * instant is what we are solving for. One pass gets within an hour, the second
 * lands exactly, which is what makes a time entered on a DST changeover day come
 * back as the hour that was typed.
 */
function parseWhen(value: string, timeZone: string, label: string): Ok<Date | null> | Fail {
  const raw = value.trim();
  if (!raw) return { ok: true, value: null };

  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!m) return { ok: false, error: `${label} is not a valid date and time.` };

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;

  // Date.UTC silently rolls 2026-13-40 forward into next year. A browser will
  // not submit that; a crafted POST would, and it would store a plausible-looking
  // wrong date rather than fail.
  const inRange =
    year >= 1970 &&
    year <= 2999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59;
  if (!inRange) return { ok: false, error: `${label} is not a valid date and time.` };

  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = wall - zoneOffsetMs(new Date(wall), timeZone);
  utc = wall - zoneOffsetMs(new Date(utc), timeZone);

  const out = new Date(utc);
  if (Number.isNaN(out.getTime())) {
    return { ok: false, error: `${label} is not a valid date and time.` };
  }
  return { ok: true, value: out };
}

/* ------------------------------------------------------------------ fields */

/**
 * Slugs are derived, not typed, unless the admin insists. A show titled
 * "Drop That Mike — Season 2!" becomes drop-that-mike-season-2 rather than a
 * 404 with an em dash in it.
 */
function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Strip the accents NFKD just split off, so "Café" becomes "cafe", not "caf".
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    // Drop apostrophes rather than turn them into hyphens: dean's -> deans.
    .replace(/\p{Quotation_Mark}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");
}

function parsePrize(raw: string): Ok<number | null> | Fail {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return { ok: true, value: null };
  if (!/^\d+$/.test(cleaned)) {
    return { ok: false, error: "Prize must be a whole number, with no decimals." };
  }
  const n = Number(cleaned);
  if (n > 100_000_000) return { ok: false, error: "That prize amount looks wrong." };
  return { ok: true, value: n };
}

/**
 * Accepts an absolute http(s) URL or a site-relative path, because the optimised
 * assets in public/media are referenced as "/media/shows/...". Anything else —
 * javascript:, data: — is refused rather than stored and rendered later.
 */
function optionalLink(raw: string, label: string): Ok<string | null> | Fail {
  const v = raw.trim();
  if (!v) return { ok: true, value: null };
  if (v.startsWith("/")) return { ok: true, value: v };
  try {
    const url = new URL(v);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { ok: false, error: `${label} must be an http:// or https:// link.` };
    }
    return { ok: true, value: url.toString() };
  } catch {
    return {
      ok: false,
      error: `${label} must be a full https:// link, or a path starting with "/".`,
    };
  }
}

function slugTaken(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/* -------------------------------------------------------------------- show */

const showForm = z.object({
  title: z.string().trim().min(2, "Give the show a title.").max(120, "Title is too long."),
  slug: z.string().trim().max(120, "Slug is too long."),
  tagline: z.string().trim().max(200, "Tagline is too long."),
  description: z.string().trim().max(6000, "Description is too long."),
  prizeAmount: z.string().trim().max(20),
  currency: z.string().trim().max(8),
  entryDeadline: z.string().trim().max(40),
  startsAt: z.string().trim().max(40),
  status: z.enum(SHOW_STATUSES, {
    errorMap: () => ({ message: "Choose a status for the show." }),
  }),
  heroImageUrl: z.string().trim().max(600, "Hero image link is too long."),
  trailerUrl: z.string().trim().max(600, "Trailer link is too long."),
  timeZone: z.string().trim().max(64),
});

type ShowForm = z.infer<typeof showForm>;

function readShowForm(fd: FormData) {
  return showForm.safeParse({
    title: s(fd, "title"),
    slug: s(fd, "slug"),
    tagline: s(fd, "tagline"),
    description: s(fd, "description"),
    prizeAmount: s(fd, "prizeAmount"),
    currency: s(fd, "currency"),
    entryDeadline: s(fd, "entryDeadline"),
    startsAt: s(fd, "startsAt"),
    status: s(fd, "status"),
    heroImageUrl: s(fd, "heroImageUrl"),
    trailerUrl: s(fd, "trailerUrl"),
    timeZone: s(fd, "timeZone"),
  });
}

type ShowData = {
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  prizeAmount: number | null;
  currency: string;
  entryDeadline: Date | null;
  startsAt: Date | null;
  status: (typeof SHOW_STATUSES)[number];
  heroImageUrl: string | null;
  trailerUrl: string | null;
};

function prepareShow(f: ShowForm): Ok<ShowData> | Fail {
  const tz = isValidZone(f.timeZone) ? f.timeZone : DEFAULT_TZ;

  const slug = f.slug ? f.slug.toLowerCase() : slugify(f.title);
  if (!slug) {
    return {
      ok: false,
      error: "That title has no letters or numbers to build a URL from — type a slug yourself.",
    };
  }
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: "The URL slug can only contain lowercase letters, numbers and hyphens.",
    };
  }

  const prize = parsePrize(f.prizeAmount);
  if (!prize.ok) return prize;

  const currency = (f.currency || "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: "Currency must be a three-letter code, such as USD." };
  }

  const deadline = parseWhen(f.entryDeadline, tz, "Entry deadline");
  if (!deadline.ok) return deadline;

  const starts = parseWhen(f.startsAt, tz, "Start time");
  if (!starts.ok) return starts;

  const hero = optionalLink(f.heroImageUrl, "Hero image");
  if (!hero.ok) return hero;

  const trailer = optionalLink(f.trailerUrl, "Trailer");
  if (!trailer.ok) return trailer;

  return {
    ok: true,
    value: {
      slug,
      title: f.title,
      tagline: f.tagline || null,
      description: f.description || null,
      prizeAmount: prize.value,
      currency,
      entryDeadline: deadline.value,
      startsAt: starts.value,
      status: f.status,
      heroImageUrl: hero.value,
      trailerUrl: trailer.value,
    },
  };
}

function snapshot(row: {
  slug: string;
  title: string;
  status: string;
  prizeAmount: number | null;
  currency: string;
  entryDeadline: Date | null;
  startsAt: Date | null;
}) {
  return {
    slug: row.slug,
    title: row.title,
    status: row.status,
    prizeAmount: row.prizeAmount,
    currency: row.currency,
    // ISO, so the audit trail records the instant and not a rendering of it.
    entryDeadline: row.entryDeadline?.toISOString() ?? null,
    startsAt: row.startsAt?.toISOString() ?? null,
  };
}

export async function createShow(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("EDITOR");

  const parsed = readShowForm(fd);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const prepared = prepareShow(parsed.data);
  if (!prepared.ok) return prepared;
  const data = prepared.value;

  // Checked up front so the admin gets a sentence instead of a Prisma stack
  // trace. The try/catch below still stands, for the race between the two.
  const clash = await prisma.show.findUnique({
    where: { slug: data.slug },
    select: { title: true },
  });
  if (clash) {
    return {
      ok: false,
      error: `The web address /shows/${data.slug} is already used by "${clash.title}". Choose a different slug.`,
    };
  }

  try {
    const show = await prisma.show.create({ data });
    await audit(user, "show.create", "Show", show.id, null, snapshot(show));
    revalidatePublic();
    return { ok: true, id: show.id };
  } catch (err) {
    if (slugTaken(err)) {
      return { ok: false, error: `The slug "${data.slug}" was just taken. Choose another.` };
    }
    throw err;
  }
}

export async function updateShow(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("EDITOR");

  const id = s(fd, "id").trim();
  if (!id) return { ok: false, error: "Missing show id." };

  const parsed = readShowForm(fd);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const prepared = prepareShow(parsed.data);
  if (!prepared.ok) return prepared;
  const data = prepared.value;

  const before = await prisma.show.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That show no longer exists." };

  if (data.slug !== before.slug) {
    const clash = await prisma.show.findUnique({
      where: { slug: data.slug },
      select: { title: true },
    });
    if (clash) {
      return {
        ok: false,
        error: `The web address /shows/${data.slug} is already used by "${clash.title}". Choose a different slug.`,
      };
    }
  }

  try {
    const after = await prisma.show.update({ where: { id }, data });
    await audit(user, "show.update", "Show", id, snapshot(before), snapshot(after));
    revalidatePublic();
    revalidatePath(`/admin/shows/${id}`);
    return { ok: true, id };
  } catch (err) {
    if (slugTaken(err)) {
      return { ok: false, error: `The slug "${data.slug}" was just taken. Choose another.` };
    }
    throw err;
  }
}

/**
 * OWNER only, and the counts go into the audit row because the row itself is
 * gone afterwards. Leads survive: Lead.showId is SetNull, so an entry is never
 * lost to a content edit. Episodes do not: they cascade.
 */
export async function deleteShow(id: string): Promise<ActionResult> {
  const user = await requireRole("OWNER");
  if (!id) return { ok: false, error: "Missing show id." };

  const show = await prisma.show.findUnique({
    where: { id },
    include: { _count: { select: { episodes: true, leads: true, winners: true, gallery: true } } },
  });
  if (!show) return { ok: false, error: "That show no longer exists." };

  await prisma.show.delete({ where: { id } });

  await audit(user, "show.delete", "Show", id, { ...snapshot(show), counts: show._count }, null);
  revalidatePublic();
  return { ok: true };
}

/* ---------------------------------------------------------------- episodes */

const episodeForm = z.object({
  id: z.string().trim().max(40),
  showId: z.string().trim().min(1, "Missing show id.").max(40),
  epTitle: z.string().trim().min(2, "Give the episode a title.").max(160, "Title is too long."),
  epNo: z.string().trim().max(6),
  epAiredAt: z.string().trim().max(40),
  epVideoUrl: z
    .string()
    .trim()
    .min(1, "Paste the YouTube link, or just the video id.")
    .max(600, "That link is too long."),
  epDescription: z.string().trim().max(2000, "Description is too long."),
  timeZone: z.string().trim().max(64),
});

/**
 * extractYouTubeId() knows watch/embed/shorts/youtu.be and a bare id. It does
 * not know youtube.com/live/<id>, which is the URL a live broadcast has — and
 * Drop That Mike is a live show, so that is the link the team will paste most.
 * Handled here rather than by editing the public read layer.
 */
function youTubeId(raw: string): string | null {
  const direct = extractYouTubeId(raw);
  if (direct) return direct;
  const live = /youtube\.com\/(?:live|v)\/([A-Za-z0-9_-]{11})/.exec(raw);
  if (live) return live[1];
  const query = /[?&]v=([A-Za-z0-9_-]{11})/.exec(raw);
  return query ? query[1] : null;
}

function parseEpisodeNo(raw: string): Ok<number | null> | Fail {
  if (!raw) return { ok: true, value: null };
  if (!/^\d{1,4}$/.test(raw)) {
    return { ok: false, error: "Episode number must be a whole number." };
  }
  return { ok: true, value: Number(raw) };
}

/**
 * One action for add and edit — the form is the same form either way, and a
 * second near-identical action is a second place for the rules to drift.
 */
export async function saveEpisode(fd: FormData): Promise<ActionResult> {
  const user = await requireRole("EDITOR");

  const parsed = episodeForm.safeParse({
    id: s(fd, "id"),
    showId: s(fd, "showId"),
    epTitle: s(fd, "epTitle"),
    epNo: s(fd, "epNo"),
    epAiredAt: s(fd, "epAiredAt"),
    epVideoUrl: s(fd, "epVideoUrl"),
    epDescription: s(fd, "epDescription"),
    timeZone: s(fd, "timeZone"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const f = parsed.data;

  const tz = isValidZone(f.timeZone) ? f.timeZone : DEFAULT_TZ;

  const videoId = youTubeId(f.epVideoUrl);
  if (!videoId) {
    // Refused rather than stored: getEpisodes() drops any episode whose videoUrl
    // has no YouTube id, so a Facebook link would save happily and then never
    // appear on /watch or the homepage. A row that silently does nothing is worse
    // than a rejected form.
    return {
      ok: false,
      error:
        "That is not a YouTube link. Paste a youtube.com or youtu.be URL, or the 11-character video id — the public video pages can only play YouTube.",
    };
  }

  const no = parseEpisodeNo(f.epNo);
  if (!no.ok) return no;

  const aired = parseWhen(f.epAiredAt, tz, "Air date");
  if (!aired.ok) return aired;

  const show = await prisma.show.findUnique({
    where: { id: f.showId },
    select: { id: true, title: true },
  });
  if (!show) return { ok: false, error: "That show no longer exists." };

  const data = {
    showId: show.id,
    title: f.epTitle,
    episodeNo: no.value,
    airedAt: aired.value,
    // Canonical form, so the public extractYouTubeId() always matches.
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    // Derived, never asked for: YouTube already hosts a thumbnail per video id
    // and asking an editor to paste one is a field that can only be wrong.
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: f.epDescription || null,
  };

  // The same video twice on one show is a double-submit, not an intention. Left
  // to Prisma it would succeed silently and put the episode on /watch twice —
  // and only an OWNER can delete the extra one.
  const duplicate = await prisma.episode.findFirst({
    where: {
      showId: show.id,
      videoUrl: data.videoUrl,
      ...(f.id ? { id: { not: f.id } } : {}),
    },
    select: { title: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `That video is already on this show as "${duplicate.title}". Edit that episode instead.`,
    };
  }

  if (f.id) {
    const before = await prisma.episode.findUnique({ where: { id: f.id } });
    if (!before || before.showId !== show.id) {
      return { ok: false, error: "That episode no longer exists on this show." };
    }
    await prisma.episode.update({ where: { id: f.id }, data });
    await audit(
      user,
      "episode.update",
      "Episode",
      f.id,
      { title: before.title, videoUrl: before.videoUrl, airedAt: before.airedAt?.toISOString() ?? null },
      { title: data.title, videoUrl: data.videoUrl, airedAt: data.airedAt?.toISOString() ?? null },
    );
    revalidatePublic();
    revalidatePath(`/admin/shows/${show.id}`);
    return { ok: true, id: f.id };
  }

  const created = await prisma.episode.create({ data });
  await audit(user, "episode.create", "Episode", created.id, null, {
    showId: show.id,
    title: data.title,
    videoUrl: data.videoUrl,
    airedAt: data.airedAt?.toISOString() ?? null,
  });
  revalidatePublic();
  revalidatePath(`/admin/shows/${show.id}`);
  return { ok: true, id: created.id };
}

export async function deleteEpisode(id: string): Promise<ActionResult> {
  const user = await requireRole("OWNER");
  if (!id) return { ok: false, error: "Missing episode id." };

  const episode = await prisma.episode.findUnique({ where: { id } });
  if (!episode) return { ok: false, error: "That episode no longer exists." };

  await prisma.episode.delete({ where: { id } });
  await audit(user, "episode.delete", "Episode", id, {
    showId: episode.showId,
    title: episode.title,
    videoUrl: episode.videoUrl,
  }, null);

  revalidatePublic();
  revalidatePath(`/admin/shows/${episode.showId}`);
  return { ok: true };
}
