import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  AdminPageHeader,
  AdminTable,
  Cell,
  EmptyState,
  Row,
  RowLink,
  StatusPill,
} from "@/components/admin/crud";

export const dynamic = "force-dynamic";

/**
 * The winners archive, as the client edits it.
 *
 * Two things are surfaced in the table rather than buried in the edit form,
 * because both are publishing decisions and both are wrong on the old site: does
 * this winner have a portrait, and is there a confirmed announcement date. The
 * old winners page shows neither, which is how it ended up naming a different
 * winner from the homepage without anyone noticing.
 */
export default async function WinnersPage() {
  await requireRole("EDITOR");

  // Deliberately the same ordering the public read layer uses (getWinners in
  // src/lib/queries.ts): announcedAt descending, which in Postgres sorts NULLs
  // first. So the row at the top of this table is the row in the homepage
  // spotlight — including when it is at the top only because it has no date.
  // Matching the two is what makes the "No date" flag below actionable.
  const winners = await prisma.winner.findMany({
    orderBy: [{ announcedAt: "desc" }, { createdAt: "desc" }],
    include: { show: { select: { title: true } } },
  });

  return (
    <>
      <AdminPageHeader
        title="Winners"
        description="Everything here publishes straight to /winners and the homepage spotlight. Names, prizes and dates are the client's facts to confirm — never fill a gap with a guess."
        action={
          <Link href="/admin/winners/new" className="btn btn-primary">
            New winner
          </Link>
        }
      />

      {winners.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No winners yet"
            body="Add the first one and it appears on /winners immediately, along with the spotlight on the homepage. A winner with no photograph still publishes — the page renders a designed stand-in rather than a broken image."
            action={
              <Link href="/admin/winners/new" className="btn btn-primary">
                Add a winner
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8">
          <AdminTable head={["Winner", "Show", "Prize", "Announced", "Portrait", "Public page"]}>
            {winners.map((w) => (
              <Row key={w.id}>
                <Cell>
                  <RowLink href={`/admin/winners/${w.id}`}>{w.name}</RowLink>
                  <span className="mt-0.5 block text-xs text-chalk-faint">/winners/{w.slug}</span>
                </Cell>
                <Cell muted>{w.show?.title ?? "—"}</Cell>
                <Cell muted>
                  {w.prizeAwarded === null ? "—" : `$${w.prizeAwarded.toLocaleString("en-US")}`}
                </Cell>
                <Cell muted>
                  {w.announcedAt ? (
                    w.announcedAt.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  ) : (
                    <StatusPill value="No date" tone="warn" />
                  )}
                </Cell>
                <Cell>
                  {w.photoUrl ? (
                    <StatusPill value="Photo" tone="good" />
                  ) : (
                    <StatusPill value="Stand-in" />
                  )}
                </Cell>
                <Cell>
                  <a
                    href={`/winners/${w.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold uppercase tracking-widest text-chalk-muted transition-colors hover:text-brand"
                  >
                    View
                  </a>
                </Cell>
              </Row>
            ))}
          </AdminTable>

          <p className="help mt-4">
            {winners.length} winner{winners.length === 1 ? "" : "s"} published. The row at the top
            of this table is the one in the homepage spotlight. A winner with no announcement date
            sorts above dated ones, so set a date once the client confirms it.
          </p>
        </div>
      )}
    </>
  );
}
