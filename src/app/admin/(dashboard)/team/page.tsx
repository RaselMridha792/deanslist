import Link from "next/link";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ROLES, requireDbRole, type Role } from "@/lib/auth";
import {
  AdminPageHeader,
  CrudForm,
  DeleteButton,
  Field,
  Select,
  StatusPill,
} from "@/components/admin/crud";
import {
  createUser,
  deleteUser,
  setUserPassword,
  setUserRole,
} from "@/app/admin/team-actions";

/**
 * Team & Roles — the only screen that hands out access to this dashboard.
 *
 * OWNER only, re-checked here as well as in every action. Nothing on this page
 * is authorisation: hiding the demote control for the last owner is a courtesy
 * to the person clicking, and src/app/admin/team-actions.ts is what actually
 * refuses. Both exist so the refusal is never a surprise.
 *
 * The gate is requireDbRole rather than requireRole, which is the same check
 * the actions make: it re-reads User.role instead of believing the role claim
 * in a seven-day-old cookie. On the one screen that hands out access, the page
 * and the actions must agree about who is an owner, or the page renders the
 * controls and every one of them then refuses.
 *
 * One editing panel is open at a time, driven by ?new=1 or ?edit=<id>. That is
 * partly restraint — a page of open forms is a page of accidental saves — and
 * partly mechanical: the shared Field and Select derive their DOM id from the
 * field name, so two role selects on one page would produce two elements with
 * id="f-role" and a label pointing at the wrong one.
 */

export const dynamic = "force-dynamic";

/** Mirrors PASSWORD_MIN in src/app/admin/team-actions.ts, which does the enforcing. */
const PASSWORD_MIN = 12;

/** What prisma/seed.ts writes when SEED_ADMIN_PASSWORD is not set. */
const SEEDED_PASSWORD = "ChangeMe123!";

/**
 * Taken from the RANK matrix in src/lib/auth.ts and from what the actions
 * actually require — not from the sales page. If an action's required role
 * changes, this copy is wrong and should change with it.
 */
const ROLE_COPY: Record<Role, { label: string; short: string; blurb: string }> = {
  REVIEWER: {
    label: "Reviewer",
    short: "reads and triages leads",
    blurb:
      "Reads everything in the dashboard and works the inbox: change a lead's status, write internal notes, apply tags. Cannot edit site content, cannot send email, cannot delete.",
  },
  EDITOR: {
    label: "Editor",
    short: "manages content and campaigns",
    blurb:
      "Everything a reviewer can do, plus the site itself — shows, episodes, winners, gallery, published statistics — and building and sending email campaigns.",
  },
  OWNER: {
    label: "Owner",
    short: "full access, including these accounts",
    blurb:
      "Everything an editor can do, plus this screen and the destructive actions: creating accounts, changing roles, and deleting a lead outright to satisfy an erasure request.",
  },
};

/** Weakest first, so the list reads as a ladder rather than an alphabet. */
const ROLE_LADDER: Role[] = [...ROLES].reverse();

const ROLE_OPTIONS = ROLE_LADDER.map((role) => ({
  value: role,
  label: `${ROLE_COPY[role].label} — ${ROLE_COPY[role].short}`,
}));

/**
 * The hash cannot be read back, so the only way to know an account is still on
 * the seeded password is to test it. bcrypt.compare throws on a malformed hash;
 * an unreadable hash is not evidence of a default password, so that is a false.
 */
async function usesSeededPassword(hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(SEEDED_PASSWORD, hash);
  } catch {
    return false;
  }
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TeamPage({ searchParams }: Props) {
  const session = await requireDbRole("OWNER");
  const params = await searchParams;

  const inviting = params.new === "1";
  // Mutually exclusive: the invite form and a manage panel both contain a role
  // select, and only one of each named field may exist in the document.
  const editingId = !inviting && typeof params.edit === "string" ? params.edit : null;

  const users = await prisma.user.findMany({
    // Role is a Prisma enum, so ascending is declaration order: OWNER first.
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      passwordHash: true,
    },
  });

  const accounts = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      seeded: await usesSeededPassword(u.passwordHash),
    })),
  );

  const ownerCount = accounts.filter((a) => a.role === "OWNER").length;
  const atRisk = accounts.filter((a) => a.seeded);

  return (
    <>
      <AdminPageHeader
        title={"Team & Roles"}
        description="Who can sign in to this dashboard, and exactly what each of them is allowed to do."
        action={
          inviting ? (
            <Link href="/admin/team" className="btn-ghost">
              Cancel
            </Link>
          ) : (
            <Link href="/admin/team?new=1" className="btn-primary">
              Add teammate
            </Link>
          )
        }
      />

      {/* Red is urgency only, and a live admin account on a password published
          in the seed script is the definition of it. */}
      {atRisk.length > 0 && (
        <div className="mt-8 rounded-card border border-brandred-live/40 bg-brandred-live/5 p-5">
          <p className="text-sm leading-relaxed text-chalk-body">
            <span className="font-semibold text-brandred-live">
              {atRisk.length} account{atRisk.length > 1 ? "s" : ""} still using the seeded
              password
            </span>{" "}
            — {atRisk.map((a) => a.email).join(", ")}. That password is written in
            prisma/seed.ts, so anyone who has seen this repository can sign in. Open the
            account below and set a real one.
          </p>
        </div>
      )}

      {inviting && (
        <section className="card mt-8 p-6">
          <h2 className="font-display text-xl tracking-wide">Add a teammate</h2>
          <p className="mt-1 max-w-2xl text-sm text-chalk-muted">
            The account works immediately. Send the password through something other than
            email, and have them replace it from this screen once they are in.
          </p>

          <div className="mt-6">
            <CrudForm
              action={createUser}
              submitLabel="Create account"
              redirectTo="/admin/team"
            >
              <Field label="Name" name="name" required placeholder="Jordan Ellis" />
              <Field
                label="Email"
                name="email"
                type="email"
                required
                placeholder="name@deanslist.live"
              />
              <Select
                label="Role"
                name="role"
                options={ROLE_OPTIONS}
                defaultValue="REVIEWER"
                required
                help="Start at the bottom. Promoting takes two clicks; un-leaking a lead list does not."
              />
              <Field
                label="Initial password"
                name="password"
                type="password"
                required
                help={`At least ${PASSWORD_MIN} characters, and it cannot contain "password" or "changeme".`}
              />
            </CrudForm>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl tracking-wide">Accounts</h2>

        <ul className="mt-4 space-y-3">
          {accounts.map((account) => {
            const isSelf = account.id === session.id;
            const isLastOwner = account.role === "OWNER" && ownerCount === 1;
            const editing = editingId === account.id;

            // Both of the destructive controls answer to the same two rules, so
            // they are gated together. The actions re-check independently.
            const manageable = !isSelf && !isLastOwner;
            const blockedReason = isSelf
              ? "This is your own account. You cannot change your own role or delete yourself — that is how the last owner locks everybody out. Another owner can do it for you."
              : "This is the last owner account. Promote a second owner first, then this one can be changed or removed.";

            return (
              <li key={account.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg tracking-wide text-chalk">
                        {account.name}
                      </p>
                      <StatusPill
                        value={ROLE_COPY[account.role].label}
                        tone={account.role === "OWNER" ? "warn" : "mute"}
                      />
                      {isSelf && <span className="badge">You</span>}
                    </div>

                    <p className="mt-1 truncate text-sm text-chalk-muted">{account.email}</p>

                    <p className="mt-1 text-xs text-chalk-faint">
                      Added {formatDate(account.createdAt)}
                    </p>

                    {account.seeded && (
                      <p className="error-text">Still on the seeded default password.</p>
                    )}
                  </div>

                  <Link
                    href={editing ? "/admin/team" : `/admin/team?edit=${account.id}`}
                    className="btn-quiet"
                  >
                    {editing ? "Close" : "Manage"}
                  </Link>
                </div>

                {editing && (
                  <div className="mt-6 space-y-8 border-t border-ink-line pt-6">
                    {manageable ? (
                      <CrudForm
                        action={setUserRole}
                        submitLabel="Update role"
                        redirectTo="/admin/team"
                      >
                        <input type="hidden" name="id" value={account.id} />
                        <Select
                          label="Role"
                          name="role"
                          options={ROLE_OPTIONS}
                          defaultValue={account.role}
                          required
                          help={ROLE_COPY[account.role].blurb}
                        />
                      </CrudForm>
                    ) : (
                      <p className="help max-w-2xl">{blockedReason}</p>
                    )}

                    {/* Available on every account including your own — otherwise
                        a sole owner on the seeded password has no way out. */}
                    <CrudForm
                      action={setUserPassword}
                      submitLabel="Set password"
                      redirectTo="/admin/team"
                    >
                      <input type="hidden" name="id" value={account.id} />
                      <Field
                        label="New password"
                        name="password"
                        type="password"
                        required
                        help={`At least ${PASSWORD_MIN} characters, and it cannot contain "password" or "changeme". The old one is replaced immediately.`}
                      />
                    </CrudForm>

                    {manageable && (
                      <div className="border-t border-ink-line pt-5">
                        <DeleteButton
                          action={deleteUser.bind(null, { id: account.id })}
                          name={account.name}
                          label="Remove account"
                          redirectTo="/admin/team"
                        />
                        <p className="help max-w-2xl">
                          Removes the sign-in only. Anything they touched stays, and the
                          audit log keeps their address so the removal can be evidenced.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl tracking-wide">What each role can do</h2>
        <p className="mt-1 max-w-2xl text-sm text-chalk-muted">
          Checked in code on every action and every admin route, not merely hidden from the
          sidebar. A role that is never enforced is decoration.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {ROLE_LADDER.map((role) => {
            const count = accounts.filter((a) => a.role === role).length;
            return (
              <div key={role} className="card p-5">
                <p className="eyebrow">{ROLE_COPY[role].label}</p>
                <p className="mt-3 text-sm leading-relaxed text-chalk-muted">
                  {ROLE_COPY[role].blurb}
                </p>
                <p className="mt-4 text-xs text-chalk-faint">
                  {count} account{count === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
