import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { env } from "@/lib/env";

const secret = () => new TextEncoder().encode(env.AUTH_SECRET);

/**
 * First line of defence only. Every admin page calls requireSession() and every
 * admin API route calls requireApiRole(), because middleware alone has proven
 * bypassable (CVE-2025-29927). Do not remove those checks on the strength of this file.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  const token = req.cookies.get("dl_session")?.value;
  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname);

  const deny = () =>
    pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(loginUrl);

  if (!token) return deny();

  try {
    await jwtVerify(token, secret());
    return NextResponse.next();
  } catch {
    return deny();
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
