import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The lead query used by the table, the detail view, and the export.
 *
 * One filter shape everywhere, parsed from URL search params. That matters for
 * more than tidiness: the campaign audience picker in Phase 7 reuses this exact
 * shape, so a saved Segment is literally a stored copy of a filter the team
 * already built and previewed in the leads table.
 */

export const LEAD_TYPES = [
  "CONTESTANT",
  "FAN",
  "SPONSOR",
  "CREW",
  "GENERAL",
  "PRESS",
] as const;

export const LEAD_STATUSES = [
  "NEW",
  "REVIEWED",
  "SHORTLISTED",
  "FINALIST",
  "REJECTED",
  "CONTACTED",
] as const;

export const LEAD_SOURCES = [
  "WEBSITE_FORM",
  "CHATBOT",
  "NEWSLETTER",
  "IMPORT",
  "MANUAL",
] as const;

export type LeadFilter = {
  q?: string;
  type?: string;
  status?: string;
  source?: string;
  showId?: string;
  country?: string;
  tag?: string;
  from?: string;
  to?: string;
  optIn?: string;
  page?: number;
};

export const PAGE_SIZE = 50;

/** Parse and validate URL search params into a filter. Unknown values are dropped. */
export function parseLeadFilter(
  sp: Record<string, string | string[] | undefined>,
): LeadFilter {
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : undefined;
  };

  const inList = (v: string | undefined, list: readonly string[]) =>
    v && list.includes(v) ? v : undefined;

  const page = Number(one("page") ?? 1);

  return {
    q: one("q"),
    type: inList(one("type"), LEAD_TYPES),
    status: inList(one("status"), LEAD_STATUSES),
    source: inList(one("source"), LEAD_SOURCES),
    showId: one("showId"),
    country: one("country"),
    tag: one("tag"),
    from: one("from"),
    to: one("to"),
    optIn: inList(one("optIn"), ["yes", "no"]),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

/** Turn a filter into a Prisma where clause. Also used to count a segment. */
export function leadWhere(f: LeadFilter): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};

  if (f.type) where.type = f.type as Prisma.LeadWhereInput["type"];
  if (f.status) where.status = f.status as Prisma.LeadWhereInput["status"];
  if (f.source) where.source = f.source as Prisma.LeadWhereInput["source"];
  if (f.showId) where.showId = f.showId;
  if (f.country) where.country = { equals: f.country, mode: "insensitive" };
  if (f.optIn) where.marketingOptIn = f.optIn === "yes";
  if (f.tag) where.tags = { some: { tag: { name: f.tag } } };

  if (f.q) {
    // Postgres ILIKE via Prisma's insensitive mode. Deliberately not full-text:
    // the team searches for a name or an address they already half-remember.
    where.OR = [
      { firstName: { contains: f.q, mode: "insensitive" } },
      { lastName: { contains: f.q, mode: "insensitive" } },
      { email: { contains: f.q, mode: "insensitive" } },
      { stageName: { contains: f.q, mode: "insensitive" } },
      { phone: { contains: f.q, mode: "insensitive" } },
    ];
  }

  if (f.from || f.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (f.from) {
      const d = new Date(f.from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (f.to) {
      const d = new Date(f.to);
      // `to` is a date, and the team means "including that day".
      if (!Number.isNaN(d.getTime())) createdAt.lte = new Date(d.setHours(23, 59, 59, 999));
    }
    if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
  }

  return where;
}

export async function findLeads(f: LeadFilter) {
  const where = leadWhere(f);
  const page = f.page ?? 1;

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        show: { select: { title: true, slug: true } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getLead(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      show: { select: { title: true, slug: true } },
      tags: { include: { tag: true } },
      assets: true,
      conversations: { include: { messages: { orderBy: { createdAt: "asc" } } } },
    },
  });
}

/** Distinct values for the filter dropdowns, so they only offer real options. */
export async function getFilterOptions() {
  const [shows, countries, tags] = await Promise.all([
    prisma.show.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.lead.findMany({
      where: { country: { not: null } },
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
      take: 200,
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    shows,
    countries: countries.map((c) => c.country).filter((c): c is string => Boolean(c)),
    tags,
  };
}

/** Rebuild a query string from a filter, dropping empty values. */
export function filterToQuery(f: LeadFilter, overrides: Partial<LeadFilter> = {}) {
  const merged = { ...f, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "" || v === null) continue;
    if (k === "page" && v === 1) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function isFilterActive(f: LeadFilter) {
  return Boolean(
    f.q || f.type || f.status || f.source || f.showId || f.country || f.tag || f.from || f.to || f.optIn,
  );
}
