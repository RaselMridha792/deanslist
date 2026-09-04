import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { parseLeadFilter, leadWhere } from "@/lib/admin/leads";

/**
 * Filtered export of the leads table. CSV and Excel — the signed scope promises
 * both, and "open the CSV in Excel" is not the same thing to a non-technical
 * client.
 *
 * Auth is re-checked here rather than relying on middleware. This endpoint
 * returns every contact record the business owns; it is the single most
 * sensitive route in the app.
 */

const MAX_ROWS = 50_000;

const COLUMNS: { key: string; label: string }[] = [
  { key: "createdAt", label: "Received" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "addressLine1", label: "Address line 1" },
  { key: "addressLine2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State / region" },
  { key: "postalCode", label: "Postcode" },
  { key: "country", label: "Country" },
  { key: "stageName", label: "Stage name" },
  { key: "talentCategory", label: "Talent category" },
  { key: "ageRange", label: "Age range" },
  { key: "performanceUrl", label: "Performance link" },
  { key: "showTitle", label: "Show" },
  { key: "source", label: "Source" },
  { key: "marketingOptIn", label: "Marketing consent" },
  { key: "consentAt", label: "Consent given" },
  { key: "unsubscribedAt", label: "Unsubscribed" },
  { key: "tags", label: "Tags" },
  { key: "message", label: "Message" },
  { key: "internalNotes", label: "Internal notes" },
];

export async function GET(req: NextRequest) {
  const auth = await requireApiRole("REVIEWER");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: auth.status },
    );
  }

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const format = sp.format === "xlsx" ? "xlsx" : "csv";
  const filter = parseLeadFilter(sp);

  const leads = await prisma.lead.findMany({
    where: leadWhere(filter),
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: {
      show: { select: { title: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  const rows = leads.map((l) => ({
    createdAt: l.createdAt.toISOString().slice(0, 19).replace("T", " "),
    type: l.type,
    status: l.status,
    firstName: l.firstName,
    lastName: l.lastName ?? "",
    email: l.email,
    phone: l.phone ?? "",
    addressLine1: l.addressLine1 ?? "",
    addressLine2: l.addressLine2 ?? "",
    city: l.city ?? "",
    state: l.state ?? "",
    postalCode: l.postalCode ?? "",
    country: l.country ?? "",
    stageName: l.stageName ?? "",
    talentCategory: l.talentCategory ?? "",
    ageRange: l.ageRange ?? "",
    performanceUrl: l.performanceUrl ?? "",
    showTitle: l.show?.title ?? "",
    source: l.source,
    marketingOptIn: l.marketingOptIn ? "Yes" : "No",
    consentAt: l.consentAt ? l.consentAt.toISOString().slice(0, 10) : "",
    unsubscribedAt: l.unsubscribedAt ? l.unsubscribedAt.toISOString().slice(0, 10) : "",
    tags: l.tags.map((t) => t.tag.name).join(", "),
    message: l.message ?? "",
    internalNotes: l.internalNotes ?? "",
  }));

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `deanslist-leads-${stamp}.${format}`;

  const body = format === "xlsx" ? buildXlsx(rows) : buildCsv(rows);
  const type =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv; charset=utf-8";

  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/* -------------------------------------------------------------------- csv */

/**
 * A leading apostrophe on anything starting =, +, - or @ blocks CSV injection:
 * without it, a contestant can put `=cmd|...` in a message field and have Excel
 * offer to execute it when the team opens the export.
 */
function csvCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${v.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Record<string, string>[]): string {
  const head = COLUMNS.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((r) => COLUMNS.map((c) => csvCell(r[c.key] ?? "")).join(","));
  // BOM so Excel opens UTF-8 correctly — without it, accented names arrive mangled.
  return "﻿" + [head, ...body].join("\r\n");
}

/* ------------------------------------------------------------------- xlsx */

/**
 * Minimal .xlsx writer. A real xlsx is a zip of XML parts, and the format needs
 * only three of them for a single flat sheet — which is cheaper than adding a
 * spreadsheet library to production installs for one export route.
 */
function buildXlsx(rows: Record<string, string>[]): Buffer {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Control characters are illegal in XML and would corrupt the file.
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  const colName = (i: number) => {
    let s = "";
    let n = i;
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
  };

  const sheetRow = (cells: string[], rowIndex: number) =>
    `<row r="${rowIndex}">` +
    cells
      .map(
        (c, i) =>
          `<c r="${colName(i)}${rowIndex}" t="inlineStr"><is><t xml:space="preserve">${esc(c)}</t></is></c>`,
      )
      .join("") +
    `</row>`;

  const sheetData =
    sheetRow(COLUMNS.map((c) => c.label), 1) +
    rows.map((r, i) => sheetRow(COLUMNS.map((c) => r[c.key] ?? ""), i + 2)).join("");

  const sheet =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${sheetData}</sheetData></worksheet>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Leads" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  return zip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRels, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbook, "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRels, "utf8") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheet, "utf8") },
  ]);
}

/* -------------------------------------------------------------------- zip */

/** CRC-32, needed by the zip central directory. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Store-only zip (no compression). The parts are a few hundred KB at most and
 * Excel reads stored entries fine, so deflate would buy nothing but a
 * dependency.
 */
function zip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0, 12); // date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    locals.push(local, name, f.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(f.data.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centrals.push(central, name);
    offset += 30 + name.length + f.data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([Buffer.concat(locals), centralBuf, end]);
}
