"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, type SessionUser } from "@/lib/auth";

/**
 * Mutations for the gallery manager.
 *
 * Same rules as every other admin mutation: the action re-checks the session
 * itself (a server action is a public HTTP endpoint, and middleware has been
 * bypassable — CVE-2025-29927), and every write lands in the AuditLog.
 *
 * The one rule specific to this screen is alt text. It is required at the schema
 * level, not just marked required in the markup, because these photographs show
 * people the old site never identifies. Alt text has to describe the scene; it
 * cannot name anyone, and an empty string would silently publish an image that
 * is invisible to a screen reader.
 */

type Result = { ok: true; id?: string } | { ok: false; error: string };

/* ------------------------------------------------------------------ audit */

/** Local copy — see the note in winners-actions.ts. */
async function audit(
  user: SessionUser,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userEmail: user.email,
      action,
      entityType: "GalleryImage",
      entityId,
      before: before as never,
      after: after as never,
    },
  });
}

function snapshot(g: {
  url: string;
  alt: string;
  caption: string | null;
  showId: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}) {
  return {
    url: g.url,
    alt: g.alt,
    caption: g.caption,
    showId: g.showId,
    width: g.width,
    height: g.height,
    sortOrder: g.sortOrder,
  };
}

/* ----------------------------------------------------------------- schema */

const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalText = (max: number, label: string) =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional(),
  );

const optionalPixels = (label: string) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string" || v.trim() === "") return undefined;
      const n = Number(v.trim());
      return Number.isFinite(n) ? n : v;
    },
    z
      .number({ invalid_type_error: `${label} must be a number of pixels` })
      .int(`${label} must be a whole number`)
      .min(1)
      .max(20000)
      .optional(),
  );

/** Blank means "put it at the top of the pile", which is 0. */
const sortOrderSchema = z.preprocess(
  (v) => {
    if (typeof v !== "string" || v.trim() === "") return 0;
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : v;
  },
  z
    .number({ invalid_type_error: "Order must be a number" })
    .int("Order must be a whole number")
    .min(0, "Order cannot be negative")
    .max(9999),
);

/**
 * Stored WITHOUT an extension. Picture appends .avif, .webp and .jpg and lets
 * the browser choose the best it can decode, so "/media/gallery/cts-01.jpg"
 * would be requested as "/media/gallery/cts-01.jpg.avif" and render nothing.
 */
const IMAGE_EXTENSION = /\.(avif|webp|jpe?g|png|gif|svg)$/i;
const SITE_PATH = /^\/[A-Za-z0-9][A-Za-z0-9/_-]*$/;

const mediaPath = z
  .string()
  .trim()
  .min(1, "An image path is required")
  .max(200)
  .superRefine((value, ctx) => {
    if (IMAGE_EXTENSION.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Leave the file extension off. The site appends .avif, .webp and .jpg itself — store /media/gallery/cts-01, not /media/gallery/cts-01.jpg.",
      });
      return;
    }
    if (!SITE_PATH.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Use a site path such as /media/gallery/cts-01 — a leading slash, no domain, no file extension.",
      });
    }
  });

/** Placeholders that pass a "required" check while telling a listener nothing. */
const FILLER_ALT = new Set([
  "image",
  "images",
  "img",
  "photo",
  "photos",
  "picture",
  "pic",
  "gallery",
  "gallery image",
  "deans list",
  "dean's list",
  "untitled",
  "n/a",
  "na",
  "none",
]);

const altSchema = z
  .string()
  .trim()
  .min(1, "Alt text is required on every image")
  .max(300, "Keep alt text under 300 characters")
  .superRefine((value, ctx) => {
    const normalised = value.toLowerCase().replace(/[.\s]+$/, "");
    if (FILLER_ALT.has(normalised) || value.trim().length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Describe what is happening in the shot — a crowd, a performance, the stage. Nobody in these photographs is identified anywhere, so a placeholder like \"photo\" leaves a screen-reader user with nothing.",
      });
      return;
    }
    if (/^\/?media\//i.test(value) || IMAGE_EXTENSION.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Alt text describes the scene, not the file. Do not paste the image path here.",
      });
    }
  });

const gallerySchema = z.object({
  url: mediaPath,
  alt: altSchema,
  caption: optionalText(300, "Caption"),
  showId: optionalText(40, "Show"),
  width: optionalPixels("Width"),
  height: optionalPixels("Height"),
  sortOrder: sortOrderSchema,
});

const LABELS: Record<string, string> = {
  url: "Image path",
  alt: "Alt text",
  caption: "Caption",
  showId: "Show",
  width: "Width",
  height: "Height",
  sortOrder: "Order",
};

function firstError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Check the form and try again.";
  const label = LABELS[String(issue.path[0] ?? "")];
  return label ? `${label} — ${issue.message}` : issue.message;
}

function prismaMessage(e: unknown, fallback: string): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2003") return "That show no longer exists. Reload the page and pick again.";
    if (e.code === "P2025") return "That image no longer exists. It may have been deleted.";
  }
  console.error("[gallery-actions]", e);
  return fallback;
}

/**
 * The homepage strip is the only public consumer today. /shows/[slug] is
 * revalidated too because an image assigned to a show is assigned for that
 * purpose, and a cache that goes stale the day someone adds a show gallery is a
 * bug nobody would connect back to this file.
 */
function revalidateGallery() {
  revalidatePath("/");
  revalidatePath("/shows/[slug]", "page");
  revalidatePath("/admin/gallery");
}

/* ----------------------------------------------------------------- create */

export async function createGalleryImage(formData: FormData): Promise<Result> {
  const user = await requireRole("EDITOR");

  const parsed = gallerySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  try {
    const image = await prisma.galleryImage.create({
      data: {
        url: d.url,
        alt: d.alt,
        caption: d.caption ?? null,
        showId: d.showId ?? null,
        width: d.width ?? null,
        height: d.height ?? null,
        sortOrder: d.sortOrder,
      },
    });

    await audit(user, "gallery.create", image.id, null, snapshot(image));
    revalidateGallery();
    return { ok: true, id: image.id };
  } catch (e) {
    return { ok: false, error: prismaMessage(e, "Could not save this image.") };
  }
}

/* ----------------------------------------------------------------- update */

export async function updateGalleryImage(formData: FormData): Promise<Result> {
  const user = await requireRole("EDITOR");

  const raw = Object.fromEntries(formData.entries());
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return { ok: false, error: "Invalid request." };

  const parsed = gallerySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const before = await prisma.galleryImage.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That image no longer exists." };

  try {
    const after = await prisma.galleryImage.update({
      where: { id },
      data: {
        url: d.url,
        alt: d.alt,
        caption: d.caption ?? null,
        showId: d.showId ?? null,
        width: d.width ?? null,
        height: d.height ?? null,
        sortOrder: d.sortOrder,
      },
    });

    await audit(user, "gallery.update", id, snapshot(before), snapshot(after));
    revalidateGallery();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: prismaMessage(e, "Could not save this image.") };
  }
}

/* ----------------------------------------------------------------- delete */

/** OWNER only, and it removes the row, not the file in public/media. */
export async function deleteGalleryImage(id: string): Promise<Result> {
  const user = await requireRole("OWNER");
  if (typeof id !== "string" || !id) return { ok: false, error: "Invalid request." };

  const before = await prisma.galleryImage.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "That image no longer exists." };

  try {
    await prisma.galleryImage.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: prismaMessage(e, "Could not delete this image.") };
  }

  await audit(user, "gallery.delete", id, snapshot(before), null);
  revalidateGallery();
  return { ok: true };
}
