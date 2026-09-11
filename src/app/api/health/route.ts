import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is this server able to serve a page?
 *
 * Used by the Docker HEALTHCHECK and by anyone checking the box by hand. It
 * answers the question that matters rather than the one that is easy: a Node
 * process that is up but cannot reach its database will render every page as
 * an error, so "the process responded" is not health.
 *
 * It deliberately says very little. No version, no hostname, no error text —
 * a public endpoint that explains why the database is unreachable is handing a
 * stranger the connection details. The server log has the reason.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, db: "up" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[health] database unreachable", err);
    return NextResponse.json(
      { ok: false, db: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
