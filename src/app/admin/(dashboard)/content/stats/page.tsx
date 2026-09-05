import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatStat } from "@/lib/queries";
import { deleteStat } from "@/app/admin/content-actions";
import {
  AdminPageHeader,
  AdminTable,
  Cell,
  DeleteButton,
  EmptyState,
  Row,
  StatusPill,
} from "@/components/admin/crud";
import { StatEditor, TakeDownButton, type StatDraft } from "./StatEditor";

export const dynamic = "force-dynamic";

const LIST = "/admin/content/stats";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/**
 * The statistics band, and the gate in front of it.
 *
 * getStats() in src/lib/queries.ts returns rows where `active` AND `verified`
 * are both true, and nothing else. That is the entire mechanism keeping an
 * unconfirmed number off the public site, so this screen is built around making
 * it visible: two explicit groups, a stated reason for every hidden row, and a
 * confirmation step in front of the switch that moves a row from one to the
 * other.
 */
export default async function StatsAdminPage({ searchParams }: Props) {
  const session = await requireRole("EDITOR");
  const params = await searchParams;

  const editId = one(params.edit);
  const creating = one(params.new) === "1";

  const [stats, editing] = await Promise.all([
    prisma.siteStat.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    editId ? prisma.siteStat.findUnique({ where: { id: editId } }) : Promise.resolve(null),
  ]);

  const showForm = creating || Boolean(editing);
  const nextOrder = stats.length ? Math.max(...stats.map((s) => s.sortOrder)) + 10 : 0;

  const rows = stats.map((s) => ({
    ...s,
    // The same function the homepage band and the sponsors page call. Anything
    // rendered here is therefore literally what a visitor would see.
    preview: formatStat({
      key: s.key,
      label: s.label,
      value: s.value,
      prefix: s.prefix ?? undefined,
      suffix: s.suffix ?? undefined,
    }),
  }));

  const live = rows.filter((s) => s.verified && s.active);
  const hidden = rows.filter((s) => !s.verified || !s.active);

  const draft: StatDraft | null = editing
    ? {
        id: editing.id,
        key: editing.key,
        label: editing.label,
        value: editing.value,
        prefix: editing.prefix,
        suffix: editing.suffix,
        displayAs: editing.displayAs,
        verified: editing.verified,
        active: editing.active,
        sortOrder: editing.sortOrder,
      }
    : null;

  const initialPreview = editing
    ? formatStat({
        key: editing.key,
        label: editing.label,
        value: editing.value,
        prefix: editing.prefix ?? undefined,
        suffix: editing.suffix ?? undefined,
      })
    : formatStat({ key: "new", label: "new", value: 0 });

  function hiddenReason(s: { verified: boolean; active: boolean }) {
    if (!s.verified && !s.active) return "Unconfirmed, and switched off";
    if (!s.verified) return "Unconfirmed — nobody has checked this number";
    return "Switched off by an editor";
  }

  return (
    <>
      <AdminPageHeader
        title="Site statistics"
        description="The audience and prize figures in the stats band on the homepage and the sponsors page."
        action={
          showForm ? (
            <Link href={LIST} className="btn btn-ghost !px-5 !py-2.5 !text-xs">
              Cancel
            </Link>
          ) : (
            <Link href={`${LIST}?new=1`} className="btn btn-primary !px-6 !py-2.5 !text-xs">
              Add statistic
            </Link>
          )
        }
      />

      {/* The rule, stated once, in the place where it is acted on. */}
      <div className="mt-6 border border-rule bg-white p-6">
        <p className="eyebrow">How the gate works</p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink">
          A figure reaches the public site only when it is both{" "}
          <span className="text-ink">verified</span> and{" "}
          <span className="text-ink">active</span>. Everything else is stored here and never
          sent to a visitor.
        </p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-neutral-700">
          This exists because the old site published two numbers it could not stand behind: the
          subscriber count rendered as &ldquo;.7Mil+&rdquo; and the Facebook figure as a bare
          &ldquo;K&rdquo;, both because the counter animated up from an empty value. A number
          shown to a prospective sponsor is an advertising claim, so it stays hidden until
          somebody confirms it at source.
        </p>
      </div>

      {showForm && (
        <div className="card mt-6 p-6">
          <p className="eyebrow">{editing ? "Edit statistic" : "New statistic"}</p>
          <div className="mt-6">
            <StatEditor
              stat={draft}
              nextOrder={nextOrder}
              initialPreview={initialPreview}
              redirectTo={LIST}
            />
          </div>
        </div>
      )}

      {stats.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No statistics yet"
            body="The stats band renders nothing until a figure is added and confirmed. That is the safe default: an empty band is better than an unchecked number in front of a sponsor."
            action={
              <Link href={`${LIST}?new=1`} className="btn btn-primary">
                Add the first statistic
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------- live */}
          <section className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-xl uppercase tracking-wide text-ink">
                Live on the public site
              </h2>
              <p className="text-xs text-neutral-600">
                {live.length === 0
                  ? "The stats band is currently rendering nothing."
                  : `${live.length} figure${live.length > 1 ? "s" : ""} visible to every visitor`}
              </p>
            </div>

            {live.length === 0 ? (
              <p className="mt-4 border border-dashed border-rule bg-white px-6 py-8 text-sm text-neutral-700">
                Nothing is published. The band hides itself rather than showing an empty row,
                so the public pages simply skip it.
              </p>
            ) : (
              <div className="mt-4">
                <AdminTable head={["Figure", "Label", "Key", "Order", ""]}>
                  {live.map((s) => (
                    <Row key={s.id}>
                      <Cell>
                        <span className="font-display text-2xl leading-none text-brand">
                          {s.preview}
                        </span>
                      </Cell>
                      <Cell>
                        <Link
                          href={`${LIST}?edit=${s.id}`}
                          className="font-medium text-ink transition-colors hover:text-brand"
                        >
                          {s.label}
                        </Link>
                      </Cell>
                      <Cell muted className="font-mono text-xs">
                        {s.key}
                      </Cell>
                      <Cell muted className="tabular-nums">
                        {s.sortOrder}
                      </Cell>
                      <Cell>
                        <div className="flex items-center justify-end gap-4">
                          <Link
                            href={`${LIST}?edit=${s.id}`}
                            className="text-xs font-semibold uppercase tracking-widest text-neutral-600 transition-colors hover:text-brand"
                          >
                            Edit
                          </Link>
                          <TakeDownButton id={s.id} label={s.label} />
                        </div>
                      </Cell>
                    </Row>
                  ))}
                </AdminTable>
              </div>
            )}
          </section>

          {/* ----------------------------------------------------- hidden */}
          <section className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-xl uppercase tracking-wide text-ink">
                Held back
              </h2>
              <p className="text-xs text-neutral-600">
                {hidden.length === 0
                  ? "Nothing is being withheld."
                  : `${hidden.length} figure${hidden.length > 1 ? "s" : ""} no visitor can see`}
              </p>
            </div>

            {hidden.length === 0 ? (
              <p className="mt-4 border border-dashed border-rule bg-white px-6 py-8 text-sm text-neutral-700">
                Every statistic on record has been confirmed and is published.
              </p>
            ) : (
              <div className="mt-4">
                <AdminTable head={["Would render as", "Label", "Why it is hidden", "", ""]}>
                  {hidden.map((s) => (
                    <Row key={s.id}>
                      <Cell>
                        <span className="font-display text-2xl leading-none text-neutral-400">
                          {s.preview}
                        </span>
                      </Cell>
                      <Cell>
                        <Link
                          href={`${LIST}?edit=${s.id}`}
                          className="font-medium text-ink transition-colors hover:text-brand"
                        >
                          {s.label}
                        </Link>
                        <span className="block font-mono text-xs text-neutral-600">{s.key}</span>
                      </Cell>
                      <Cell muted>{hiddenReason(s)}</Cell>
                      <Cell>
                        <StatusPill
                          value={s.verified ? "Verified" : "Unconfirmed"}
                          tone={s.verified ? "good" : "warn"}
                        />
                      </Cell>
                      <Cell>
                        <div className="flex items-center justify-end gap-4">
                          <Link
                            href={`${LIST}?edit=${s.id}`}
                            className="text-xs font-semibold uppercase tracking-widest text-brand transition-colors hover:text-brand-soft"
                          >
                            Review &amp; publish
                          </Link>
                          {session.role === "OWNER" && (
                            <DeleteButton action={deleteStat.bind(null, s.id)} name={s.label} />
                          )}
                        </div>
                      </Cell>
                    </Row>
                  ))}
                </AdminTable>
              </div>
            )}
          </section>
        </>
      )}

      <p className="mt-8 max-w-prose text-xs leading-relaxed text-neutral-600">
        Open question for the client: the 700,000 subscriber figure comes from the proposal, not
        from a counted source, and the old site&apos;s own display of it is broken. It stays
        unconfirmed until someone reads the real number off YouTube and Facebook.
        {session.role !== "OWNER" && " Deleting a statistic is restricted to the account owner."}
      </p>
    </>
  );
}
