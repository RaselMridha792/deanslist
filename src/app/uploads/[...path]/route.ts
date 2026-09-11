import { readStoredFile } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uploaded images, when nothing in front of the app serves them.
 *
 * In production Caddy answers /uploads/* from the volume before a request ever
 * reaches Node, so this route does not run there. It exists so the same paths
 * work under `next dev` and in the CI smoke test, where there is no Caddy, and
 * it sends the same headers Caddy does so the two cannot behave differently.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const file = await readStoredFile(path);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(file.data.byteLength),
      // Every stored name is random and never reused, so a file at a given URL
      // can never change. A replaced poster is a new upload at a new URL.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
