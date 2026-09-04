import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

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

/**
 * Session revocation, in one column.
 *
 * A JWT is valid until it expires and this one lives seven days. Without a
 * revocation check, removing a teammate or demoting an owner does nothing until
 * their cookie runs out: the row is gone or downgraded, the cookie still says
 * OWNER, and they keep working for the rest of the week.
 *
 * So `User.sessionVersion` is stamped into the token when it is signed and
 * compared against the row on every check. Bump the column and every token
 * issued before the bump stops verifying — see src/app/admin/team-actions.ts,
 * which bumps it on a role change and on a password change. A deleted account
 * needs no bump: the row lookup below finds nothing and the session is refused.
 */
type SessionClaims = SessionUser & { sessionVersion: number };

export async function createSession(user: SessionUser) {
  // Read at sign time rather than taken as an argument, so callers do not have
  // to know the column exists and cannot forget to pass it.
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { sessionVersion: true },
  });
  // Fail closed. A token minted for an account that is not there would be a
  // token no revocation check could ever match.
  if (!row) throw new Error("Cannot start a session for an account that does not exist.");

  const claims: SessionClaims = { ...user, sessionVersion: row.sessionVersion };

  const token = await new SignJWT({ ...claims })
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

/**
 * Verifies the signature AND that the token has not been revoked.
 *
 * Yes, this reads the database on every session check. That is deliberate and
 * it is cheap: a single primary-key select, only ever on /admin and
 * /api/admin — the public site never calls getSession() at all, so no visitor
 * page pays for it. The admin side is a handful of staff, not a hot path. The
 * alternative is signature-only verification, which is what let a revoked owner
 * keep full access for up to seven days.
 *
 * Tokens minted before `sessionVersion` existed carry no version claim and are
 * refused here; the whole team signs in once more and that is the end of it.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.sessionVersion !== "number" ||
      !ROLES.includes(payload.role as Role)
    ) {
      return null;
    }

    const row = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { sessionVersion: true },
    });
    // Deleted account, or a token issued before the last revocation.
    if (!row || row.sessionVersion !== payload.sessionVersion) return null;

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

/**
 * Which role check to reach for
 * -----------------------------
 * `requireRole()` trusts the role claim carried in the token. `requireDbRole()`
 * re-reads User.role from the row and trusts that instead. They differ only
 * while a token is out of date with the row it was minted from.
 *
 * That window is now small — changing a role bumps sessionVersion, which kills
 * every existing token for that account — but it is not zero: a role edited
 * straight in the database (Prisma Studio, psql, a future script that forgets
 * the bump) leaves a live token claiming the old role.
 *
 *   requireRole(role)    — the default, and correct for every ordinary admin
 *                          screen. One stale EDITOR for a few minutes is a far
 *                          smaller problem than a database round trip added to
 *                          a check that is already made.
 *   requireDbRole(role)  — for the screens that hand out access itself, where
 *                          being wrong about who is an OWNER is the whole risk.
 *                          Used by /admin/team and by every action behind it,
 *                          so the page and its actions can never disagree about
 *                          who is allowed to be there.
 */
export async function requireRole(required: Role): Promise<SessionUser> {
  const session = await requireSession();
  if (!hasRole(session.role, required)) redirect("/admin?denied=1");
  return session;
}

/**
 * Database-backed role check. Returns the session with the role as the row
 * currently states it, so callers report and audit the live role rather than
 * the claimed one. Redirects to the dashboard when the account no longer holds
 * the required role, and to the login page when it no longer exists at all.
 */
export async function requireDbRole(required: Role): Promise<SessionUser> {
  const user = await checkDbRole(required);
  if (!user) redirect("/admin?denied=1");
  return user;
}

/**
 * Non-redirecting variant of requireDbRole, for server actions that would
 * rather answer with a message the user can read than bounce them to a page
 * that does not explain itself. Still redirects when there is no session at
 * all, because there is nobody left to show a message to.
 */
export async function checkDbRole(required: Role): Promise<SessionUser | null> {
  const session = await requireSession();
  const row = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true },
  });
  if (!row || !hasRole(row.role, required)) return null;
  return { ...session, role: row.role };
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
