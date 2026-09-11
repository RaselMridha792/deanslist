import { randomBytes } from "node:crypto";

/**
 * Dashboard accounts the suite owns.
 *
 * The suite used to sign in as the real accounts: admin@deanslist.live on the
 * seed password, and reviewer@deanslist.live. That broke the day the site went
 * live. At cutover both passwords were rotated, as they had to be, and every
 * signed-in test failed with a 401 that said nothing about why.
 *
 * So against a local target the suite brings its own: one OWNER and one
 * REVIEWER on @deanslist.test, created before the run and deleted after it.
 *
 * The passwords are random per run and never written down. They reach the
 * tests as E2E_* environment variables, which Playwright hands from global
 * setup to every worker. A run killed before teardown therefore leaves behind
 * two accounts nobody can sign in to, rather than an OWNER with a password
 * printed in this repository. That matters because .env has pointed at the
 * production database before.
 *
 * Nothing here touches a real account. An E2E_* variable set by hand wins, and
 * that account is left alone.
 */

export const PROVISIONED = "E2E_ACCOUNTS_PROVISIONED";

const ACCOUNTS = [
  {
    email: "e2e-owner@deanslist.test",
    name: "E2E Owner",
    role: "OWNER",
    emailVar: "E2E_ADMIN_EMAIL",
    passwordVar: "E2E_ADMIN_PASSWORD",
  },
  {
    email: "e2e-reviewer@deanslist.test",
    name: "E2E Reviewer",
    role: "REVIEWER",
    emailVar: "E2E_REVIEWER_EMAIL",
    passwordVar: "E2E_REVIEWER_PASSWORD",
  },
] as const;

export function isLocalTarget(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
}

export async function provisionTestAccounts(): Promise<void> {
  const todo = ACCOUNTS.filter((a) => !process.env[a.emailVar]);
  if (todo.length === 0) return;

  const { PrismaClient } = await import("@prisma/client");
  const bcrypt = (await import("bcryptjs")).default;
  const prisma = new PrismaClient();
  try {
    for (const a of todo) {
      const password = randomBytes(18).toString("base64url");
      // The same cost the Team screen uses.
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.upsert({
        where: { email: a.email },
        create: { email: a.email, name: a.name, role: a.role, passwordHash },
        update: { name: a.name, role: a.role, passwordHash },
      });
      process.env[a.emailVar] = a.email;
      process.env[a.passwordVar] = password;
    }
    process.env[PROVISIONED] = todo.map((a) => a.email).join(",");
  } finally {
    await prisma.$disconnect();
  }
}

export async function removeTestAccounts(): Promise<void> {
  const emails = (process.env[PROVISIONED] ?? "").split(",").filter(Boolean);
  if (emails.length === 0) return;

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  } finally {
    await prisma.$disconnect();
  }
}
