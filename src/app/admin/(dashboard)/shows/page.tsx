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
 * Times are rendered in one stated zone rather than the server's, which is UTC
 * on the VPS and the developer's zone locally. Charleston, WV is Eastern, so
 * that is the zone the team announces a show in — the column headers say so
 * rather than leaving the reader to guess.
 */
const DISPLAY_TZ = "America/New_York";

const STATUS_TONE: Record<string, "good" | "warn" | "mute"> = {
  LIVE: "warn",
  OPEN: "good",
  DRAFT: "mute",
  CLOSED: "mute",
  ARCHIVED: "mute",
};

/** "America/New_York" -> "New York". "UTC" stays "UTC". */
function shortZone(timeZone: string): string {
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

function when(d: Date | null) {
  if (!d) return null;
  return d.toLocaleString("en-GB", {
    timeZone: DISPLAY_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(amount: number | null, currency: string) {
  if (amount === null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // An unknown code should show the number, not blow up the whole table.
    return `${amount.toLocaleString("en-US")} ${currency}`;
  }
}

export default async function ShowsPage() {
  await requireRole("EDITOR");

  const shows = await prisma.show.findMany({
    orderBy: [{ startsAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { _count: { select: { episodes: true, leads: true } } },
  });

  const live = shows.filter((s) => s.status === "LIVE");
  const open = shows.filter((s) => s.status === "OPEN");

  return (
    <>
      <AdminPageHeader
        title="Shows & Events"
        description="The show that is LIVE — or OPEN if none is live — is the one the homepage hero, the countdown and the entry funnel point at."
        action={
          <Link href="/admin/shows/new" className="btn btn-primary">
            New show
          </Link>
        }
      />

      {/* getCurrentShow() takes the first LIVE row it finds. With two of them the
          homepage picks one on an ordering nobody chose, and it will not be
          obvious which — so this is a warning, not a note. */}
      {live.length > 1 && (
        <div className="mt-8 border border-brand/40 bg-brand/5 p-5">
          <p className="text-sm text-ink">
            <span className="font-semibold text-brand-onLight">
              {live.length} shows are LIVE at once.
            </span>{" "}
            The homepage hero can only feature one, and which one it picks is not
            something the team controls. Set the others to OPEN, CLOSED or DRAFT:{" "}
            {live.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link href={`/admin/shows/${s.id}`} className="text-brand hover:underline">
                  {s.title}
                </Link>
              </span>
            ))}
            .
          </p>
        </div>
      )}

      {live.length === 0 && open.length === 0 && shows.length > 0 && (
        <div className="mt-8 border border-brand/30 bg-brand/5 p-5">
          <p className="text-sm text-ink">
            <span className="font-semibold text-brand">No show is LIVE or OPEN.</span> The
            homepage hero falls back to whichever show is listed first, and nothing is
            taking entries. Set one to OPEN when entries reopen.
          </p>
        </div>
      )}

      <div className="mt-8">
        {shows.length === 0 ? (
          <EmptyState
            title="No shows yet"
            body="A show is what the homepage hero, the countdown, the entry form and every episode hang off. Create the first one to give the public site something to point at."
            action={
              <Link href="/admin/shows/new" className="btn btn-primary">
                Create the first show
              </Link>
            }
          />
        ) : (
          <>
            <AdminTable
              head={[
                "Show",
                "Status",
                `Starts (${shortZone(DISPLAY_TZ)})`,
                "Entry deadline",
                "Prize",
                "Episodes",
                "Entries",
              ]}
            >
              {shows.map((s) => (
                <Row key={s.id}>
                  <Cell>
                    <RowLink href={`/admin/shows/${s.id}`}>{s.title}</RowLink>
                    <span className="mt-0.5 block text-xs text-neutral-600">/shows/{s.slug}</span>
                  </Cell>
                  <Cell>
                    <StatusPill value={s.status} tone={STATUS_TONE[s.status]} />
                  </Cell>
                  <Cell muted>{when(s.startsAt) ?? <Missing />}</Cell>
                  <Cell muted>{when(s.entryDeadline) ?? <Missing />}</Cell>
                  <Cell muted>{money(s.prizeAmount, s.currency) ?? <Missing />}</Cell>
                  <Cell muted>{s._count.episodes}</Cell>
                  <Cell muted>
                    {s._count.leads > 0 ? (
                      <Link
                        href={`/admin/leads?showId=${s.id}`}
                        className="text-neutral-700 transition-colors hover:text-brand"
                      >
                        {s._count.leads}
                      </Link>
                    ) : (
                      0
                    )}
                  </Cell>
                </Row>
              ))}
            </AdminTable>

            <p className="mt-4 text-xs text-neutral-600">
              All times shown in {DISPLAY_TZ.replace("_", " ")}. A blank date is a date the
              client has not confirmed — the countdown stays hidden until one is set, which
              is deliberate: the old site published two different show dates.
            </p>
          </>
        )}
      </div>
    </>
  );
}

/** An unset date is a pending client answer, not a formatting failure. */
function Missing() {
  return <span className="text-neutral-400">Not set</span>;
}
