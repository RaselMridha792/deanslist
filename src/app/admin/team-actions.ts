"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES, checkDbRole, createSession, type SessionUser } from "@/lib/auth";

/**
 * Account management for /admin/team. OWNER only, every action.
 *
 * A server action is a public HTTP endpoint with a generated name. Being
 * reachable only from a page behind a login is not authorisation, and
 * middleware has proven bypassable (CVE-2025-29927), so each action
 * re-authorises and re-validates for itself.
 *
 * Three safety rules live here, and here is the only place they are guaranteed:
 *   1. Nobody changes their own role.
 *   2. Nobody deletes their own account.
 *   3. The last OWNER can be neither demoted nor deleted.
 *
 * The page hides the controls for all three, but a hidden button is a courtesy.
 * Rule 3 is counted AFTER the write and INSIDE a serializable transaction, so
 * two owners demoting each other in the same instant cannot both succeed — one
 * is rolled back rather than leaving a dashboard nobody can administer.
 *
 * A fourth rule is the reason any of this bites: a change here must reach the
 * target's browser, not just the database. Sessions are JWTs that live seven
 * days, so demoting an owner or removing a teammate changes nothing at all
 * until their cookie expires unless the token is revoked with it. Every write
 * below that alters what an account may do bumps User.sessionVersion, which
 * src/lib/auth.ts compares against the token on every check; deleting the row
 * revokes it outright.
 */

/** Cost 10, matching prisma/seed.ts. Change it in both places or not at all. */
const BCRYPT_COST = 10;

const PASSWORD_MIN = 12;

/**
 * The seed writes ChangeMe123! and the client will otherwise keep it forever.
 * Substring match, so ChangeMe123456 and Password2024 are refused too.
 */
const WEAK_SUBSTRINGS = ["password", "changeme"];

type Result = { ok: true; id?: string } | { ok: false; error: string };

/** Thrown inside a transaction to roll it back with a message worth showing. */
class TeamError extends Error {}

const LAST_OWNER =
  "That is the last owner account. Promote another owner first, or nobody can administer this dashboard.";

const STALE_SESSION = "Your account no longer has owner access. Sign out and back in.";

/* ----------------------------------------------------------------- schemas */

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
  .max(200, "Password must be 200 characters or fewer.")
  .refine(
    (v) => !WEAK_SUBSTRINGS.some((w) => v.toLowerCase().includes(w)),
    'Password cannot contain "password" or "changeme".',
  );

const roleSchema = z.enum(ROLES);

const createSchema = z.object({
  name: z.string().min(2, "Name is required.").max(80),
  email: z
    .string()
    .email("That is not a valid email address.")
    .max(180)
    .transform((v) => v.toLowerCase()),
  role: roleSchema,
  password: passwordSchema,
});

const roleChangeSchema = z.object({ id: z.string().min(1), role: roleSchema });
const passwordChangeSchema = z.object({ id: z.string().min(1), password: passwordSchema });
const idSchema = z.object({ id: z.string().min(1) });

/* ----------------------------------------------------------------- helpers */

/** FormData values are string | File | null. Anything not a string is not input. */
function field(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Passwords are not trimmed: leading and trailing spaces are the user's choice. */
function secret(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

/**
 * The session role is carried in a JWT, so a role edited straight in the
 * database — Prisma Studio, psql, a script that forgets to bump
 * sessionVersion — leaves a live token still claiming OWNER. On the one screen
 * that hands out access, re-read the row before trusting the token.
 *
 * checkDbRole is the same check /admin/team gates on (there through
 * requireDbRole), so the page and these actions cannot disagree about who is an
 * owner. Null rather than a redirect, so the caller can say why.
 */
async function requireOwner(): Promise<SessionUser | null> {
  return checkDbRole("OWNER");
}

/**
 * AuditLog payload. before and after are Json? columns, and Prisma rejects a
 * plain null for those, so absence is expressed as undefined.
 *
 * Never put a password or a hash in here. The audit log is read by more people,
 * and kept longer, than the users table.
 */
function auditData(
  actor: SessionUser,
  action: string,
  entityId: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
) {
  return {
    userId: actor.id,
    userEmail: actor.email,
    action,
    entityType: "User",
    entityId,
    before: (before ?? undefined) as never,
    after: (after ?? undefined) as never,
  };
}

function errorCode(err: unknown): string | null {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** Turns a rolled-back transaction into a message; anything unexpected rethrows. */
function toResult(err: unknown): Result {
  if (err instanceof TeamError) return { ok: false, error: err.message };
  // P2034 — a serializable transaction lost a write conflict.
  if (errorCode(err) === "P2034") {
    return { ok: false, error: "Another change landed at the same moment. Try again." };
  }
  throw err;
}

/* ------------------------------------------------------------------ create */

export async function createUser(data: FormData): Promise<Result> {
  const actor = await requireOwner();
  if (!actor) return { ok: false, error: STALE_SESSION };
  if (!(data instanceof FormData)) return { ok: false, error: "Invalid request." };

  const parsed = createSchema.safeParse({
    name: field(data, "name"),
    email: field(data, "email"),
    role: field(data, "role"),
    password: secret(data, "password"),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, email, role, password } = parsed.data;

  const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (clash) return { ok: false, error: "That email address already has an account." };

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, role, passwordHash },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: auditData(actor, "user.create", user.id, undefined, { name, email, role }),
      });
      return user;
    });

    revalidatePath("/admin/team");
    return { ok: true, id: created.id };
  } catch (err) {
    // Unique violation: the same address was created between the check and the write.
    if (errorCode(err) === "P2002") {
      return { ok: false, error: "That email address already has an account." };
    }
    return toResult(err);
  }
}

/* -------------------------------------------------------------------- role */

export async function setUserRole(data: FormData): Promise<Result> {
  const actor = await requireOwner();
  if (!actor) return { ok: false, error: STALE_SESSION };
  if (!(data instanceof FormData)) return { ok: false, error: "Invalid request." };

  const parsed = roleChangeSchema.safeParse({
    id: field(data, "id"),
    role: field(data, "role"),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, role } = parsed.data;

  // Rule 1. Self-demotion is how the last owner locks everybody out by accident.
  if (id === actor.id) {
    return { ok: false, error: "You cannot change your own role. Ask another owner to do it." };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id },
          select: { id: true, name: true, email: true, role: true },
        });
        if (!target) throw new TeamError("That account no longer exists.");
        if (target.role === role) return;

        // The bump is the point of the write reaching them: it invalidates
        // every token already issued to this account, so a demoted owner loses
        // owner access on their next request instead of at the end of the week.
        await tx.user.update({
          where: { id },
          data: { role, sessionVersion: { increment: 1 } },
        });

        // Rule 3, counted after the write so the count includes this change.
        const owners = await tx.user.count({ where: { role: "OWNER" } });
        if (owners === 0) throw new TeamError(LAST_OWNER);

        await tx.auditLog.create({
          data: auditData(
            actor,
            "user.role_change",
            id,
            { email: target.email, role: target.role },
            { email: target.email, role },
          ),
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    return toResult(err);
  }

  revalidatePath("/admin/team");
  return { ok: true };
}

/* ---------------------------------------------------------------- password */

/**
 * Allowed on your own account on purpose: the seeded owner is usually the one
 * still on ChangeMe123!, and refusing them here would leave the warning on the
 * team page with no way to act on it.
 */
export async function setUserPassword(data: FormData): Promise<Result> {
  const actor = await requireOwner();
  if (!actor) return { ok: false, error: STALE_SESSION };
  if (!(data instanceof FormData)) return { ok: false, error: "Invalid request." };

  const parsed = passwordChangeSchema.safeParse({
    id: field(data, "id"),
    password: secret(data, "password"),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, password } = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!target) return { ok: false, error: "That account no longer exists." };

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await prisma.$transaction(async (tx) => {
    // Bumped with the hash: a password reset that leaves the old sessions alive
    // is not a password reset. Whoever was signed in on the old one is out.
    await tx.user.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    // Records that it happened and to whom. The value itself never goes in.
    await tx.auditLog.create({
      data: auditData(actor, "user.password_set", id, undefined, { email: target.email }),
    });
  });

  // Changing your own password logs out your other devices, including this
  // one — the cookie in this browser was signed with the old version. Re-issue
  // it for the actor only: they just proved who they are, and the sole owner
  // clearing the seeded password should not be bounced to the login screen for
  // doing the thing this page nags them to do.
  if (id === actor.id) await createSession(actor);

  revalidatePath("/admin/team");
  return { ok: true };
}

/* ------------------------------------------------------------------ delete */

/**
 * Hard delete. Takes an object rather than FormData so the page can bind it to
 * the shared DeleteButton, which confirms by typing the account name.
 */
export async function deleteUser(input: unknown): Promise<Result> {
  const actor = await requireOwner();
  if (!actor) return { ok: false, error: STALE_SESSION };

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id } = parsed.data;

  // Rule 2.
  if (id === actor.id) {
    return {
      ok: false,
      error: "You cannot delete your own account. Ask another owner to do it.",
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id },
          select: { id: true, name: true, email: true, role: true },
        });
        if (!target) throw new TeamError("That account no longer exists.");

        // No sessionVersion bump here, and none is needed: the revocation check
        // in getSession() looks this row up by id, so once it is gone the
        // teammate's cookie stops verifying on their very next request.
        await tx.user.delete({ where: { id } });

        // Rule 3 again, same reasoning: count what is left, not what was there.
        const owners = await tx.user.count({ where: { role: "OWNER" } });
        if (owners === 0) throw new TeamError(LAST_OWNER);

        // The email stays in the log so the removal itself can be evidenced.
        await tx.auditLog.create({
          data: auditData(
            actor,
            "user.delete",
            id,
            { name: target.name, email: target.email, role: target.role },
            undefined,
          ),
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    return toResult(err);
  }

  revalidatePath("/admin/team");
  return { ok: true };
}
