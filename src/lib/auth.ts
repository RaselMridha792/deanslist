import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

const COOKIE = "dl_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * No `?? "dev-only-..."` fallback here on purpose. `env.AUTH_SECRET` is validated
 * in src/lib/env.ts and throws at boot in production if it is missing, short, or
 * still a placeholder. A shared default would let anyone with repository access
 * mint a valid OWNER session.
 */
const secret = () => new TextEncoder().encode(env.AUTH_SECRET);

export const ROLES = ["OWNER", "EDITOR", "REVIEWER"] as const;
export type Role = (typeof ROLES)[number];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/**
 * Role capability matrix. Checked in code, never merely declared in the schema.
 *   REVIEWER — read everything, change lead status and notes only
 *   EDITOR   — the above plus manage site content and send campaigns
 *   OWNER    — everything, including user management and destructive actions
 */
const RANK: Record<Role, number> = { REVIEWER: 1, EDITOR: 2, OWNER: 3 };

export function hasRole(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.id !== "string" ||
      typeof payload.email !== "string" ||
      !ROLES.includes(payload.role as Role)
    ) {
      return null;
    }
    return {
      id: payload.id,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : payload.email,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/**
 * Use in every admin page and server action. Middleware protects page routes,
 * but middleware has been bypassable in past Next.js releases (CVE-2025-29927),
 * so authorisation is re-checked at the point of data access. Defence in depth.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function requireRole(required: Role): Promise<SessionUser> {
  const session = await requireSession();
  if (!hasRole(session.role, required)) redirect("/admin?denied=1");
  return session;
}

/**
 * API-route variant: returns null instead of redirecting, so the caller can
 * answer with a 401/403 rather than an HTML redirect.
 */
export async function requireApiRole(
  required: Role,
): Promise<{ ok: true; user: SessionUser } | { ok: false; status: 401 | 403 }> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401 };
  if (!hasRole(session.role, required)) return { ok: false, status: 403 };
  return { ok: true, user: session };
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}
