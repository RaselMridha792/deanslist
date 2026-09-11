import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, storeImage, UploadRejected } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upload one image from the dashboard: a campaign poster, a winner's portrait,
 * a show's key art, a sponsor's logo.
 *
 * Staff only. The public forms still take performance videos as links: a
 * contestant's video is hundreds of megabytes, and a 50 GB disk shared with the
 * database would fill in a season of entries.
 *
 * Answers with the stored path. The form puts it in the field and the normal
 * save stores it, so an upload that is never saved is an unused file rather
 * than a half-changed record.
 */
export async function POST(req: Request) {
  const auth = await requireApiRole("EDITOR");
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Sign in again." : "Your role cannot upload files." },
      { status: auth.status },
    );
  }
  const user = auth.user;

  // Per person, generous for real use: a busy afternoon of editing is a dozen
  // images. The limit exists for a stolen session scripted to fill the disk.
  const limit = rateLimit(`upload:${user.id}`, 40, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many uploads in a few minutes. Wait a little and try again." },
      { status: 429 },
    );
  }

  // Refused before the body is read, when the client is honest about its size.
  // The file's own size is checked again below for when it is not.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json(
      { error: `That file is over the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit.` },
      { status: 413 },
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "The upload did not arrive whole. Try again." }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `That file is over the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit.` },
      { status: 413 },
    );
  }

  try {
    const stored = await storeImage(Buffer.from(await file.arrayBuffer()));
    // The name as sent is kept for the record only. It is never used to build
    // a path, and it is trimmed so a hostile one cannot bloat the row.
    const originalName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 200) || null;

    const asset = await prisma.asset.create({
      data: {
        kind: "photo",
        url: stored.path,
        key: stored.path.replace(/^\//, ""),
        mimeType: `image/${stored.format}`,
        sizeBytes: stored.bytes,
        originalName,
      },
      select: { id: true },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: "asset.upload",
        entityType: "Asset",
        entityId: asset.id,
        after: { path: stored.path, originalName, width: stored.width, height: stored.height },
      },
    });

    return NextResponse.json({
      path: stored.path,
      width: stored.width,
      height: stored.height,
      hasAlpha: stored.hasAlpha,
    });
  } catch (err) {
    if (err instanceof UploadRejected) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[upload] failed", err);
    return NextResponse.json(
      { error: "The image could not be saved on the server. Try again, and tell the developer if it keeps failing." },
      { status: 500 },
    );
  }
}
