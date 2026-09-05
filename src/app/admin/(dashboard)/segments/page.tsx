import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  LEAD_TYPES,
  LEAD_STATUSES,
  LEAD_SOURCES,
  getFilterOptions,
  parseLeadFilter,
  filterToQuery,
  type LeadFilter,
} from "@/lib/admin/leads";
import { coerceFilter, countAudience } from "@/lib/campaigns/send";
import { saveSegment, deleteSegment, recountSegment } from "@/app/admin/campaign-actions";
import {
  AdminPageHeader,
  AdminTable,
  Cell,
  Checkbox,
  CrudForm,
  DeleteButton,
  EmptyState,
  Field,
  Row,
  Select,
  TextArea,
} from "@/components/admin/crud";

export const dynamic = "force-dynamic";

/**
 * Saved audiences.
 *
 * A Segment is not a new concept to learn — it is a filter the team already
 * built and previewed in the leads table, given a name. The form below uses the
 * same field names the leads table uses in its URL, so
 * `/admin/segments?type=CONTESTANT&country=US` arrives pre-filled and "save this
 * view" is a link rather than a feature.
 */

const STALE_MS = 5 * 60 * 1000;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SegmentsPage({ searchParams }: Props) {
  await requireRole("EDITOR");

  const sp = await searchParams;
  const prefill = parseLeadFilter(sp);

  const [segments, options] = await Promise.all([
    prisma.segment.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { campaigns: true } } },
    }),
    getFilterOptions(),
  ]);

  // The live number, not the cached one. A stale recipient count is how a
  // campaign goes to four hundred people when the team expected four thousand.
  const counted = await Promise.all(
    segments.map(async (segment) => {
      const filter = coerceFilter(segment.filter);
      const counts = await countAudience(filter);
      const stale =
        !segment.lastCountAt || Date.now() - segment.lastCountAt.getTime() > STALE_MS;
      if (stale || segment.lastCount !== counts.mailable) {
        await prisma.segment.update({
          where: { id: segment.id },
          data: { lastCount: counts.mailable, lastCountAt: new Date() },
        });
      }
      return { segment, filter, ...counts };
    }),
  );

  const showTitle = (id?: string) => options.shows.find((s) => s.id === id)?.title ?? id;

  return (
    <>
      <AdminPageHeader
        title="Segments"
        description="Saved audiences for the campaign composer. Build the view you want in Leads &amp; Entries, then save it here — a segment is that same filter with a name on it."
        action={
          <Link href="/admin/leads" className="btn btn-ghost !px-5 !py-2.5 !text-xs">
            Build a view in Leads
          </Link>
        }
      />

      <div className="mt-8">
        {counted.length === 0 ? (
          <EmptyState
            title="No saved audiences"
            body="Filter the leads table down to the people you want to reach, then come back and save that filter as a named segment."
          />
        ) : (
          <AdminTable head={["Segment", "Filter", "Consented recipients", ""]}>
            {counted.map(({ segment, filter, matching, mailable }) => (
              <Row key={segment.id}>
                <Cell>
                  <span className="font-medium text-admin-text">{segment.name}</span>
                  {segment.description && (
                    <span className="mt-1 block text-xs text-admin-faint">
                      {segment.description}
                    </span>
                  )}
                  {segment._count.campaigns > 0 && (
                    <span className="mt-1 block text-[11px] uppercase tracking-widest text-admin-faint">
                      used by {segment._count.campaigns} campaign
                      {segment._count.campaigns === 1 ? "" : "s"}
                    </span>
                  )}
                </Cell>

                <Cell muted>
                  <FilterSummary filter={filter} showTitle={showTitle} />
                  <Link
                    href={`/admin/leads${filterToQuery(filter)}`}
                    className="mt-2 inline-block text-[11px] uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
                  >
                    Open in leads
                  </Link>
                </Cell>

                <Cell>
                  <span className="font-display text-2xl text-brand-onDark">
                    {mailable.toLocaleString("en-US")}
                  </span>
                  <span className="mt-1 block text-[11px] text-admin-faint">
                    of {matching.toLocaleString("en-US")} matching · rest have not opted in
                  </span>
                  {/* Inline server action: the recount is idempotent and needs no
                      confirmation, so a one-button form beats a client island. */}
                  <form
                    action={async () => {
                      "use server";
                      await recountSegment(segment.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="mt-2 text-[11px] uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
                    >
                      Recount now
                    </button>
                  </form>
                </Cell>

                <Cell className="text-right">
                  <DeleteButton
                    action={deleteSegment.bind(null, segment.id)}
                    name={segment.name}
                  />
                </Cell>
              </Row>
            ))}
          </AdminTable>
        )}
      </div>

      <section className="mt-10 card p-6">
        <p className="eyebrow">New segment</p>
        <h2 className="mt-2 font-display text-2xl tracking-wide">Save an audience</h2>
        <p className="mt-2 max-w-2xl text-sm text-admin-muted">
          Every field is optional. Leave one blank and it does not narrow the audience.
          Marketing consent is not a filter here — a campaign never reaches somebody who has
          not opted in, whatever the segment says.
        </p>

        <div className="mt-6">
          <CrudForm action={saveSegment} submitLabel="Save segment">
            <Field
              label="Name"
              name="name"
              required
              defaultValue={suggestName(prefill, showTitle)}
              placeholder="UK contestants, 2026"
            />
            <Field
              label="Search text"
              name="q"
              defaultValue={prefill.q}
              placeholder="Name, email, stage name"
              help="Matches the same fields the leads search matches."
            />

            <TextArea
              label="Description"
              name="description"
              rows={2}
              placeholder="Who is in this audience and why"
            />

            <Select
              label="Type"
              name="type"
              defaultValue={prefill.type}
              placeholder="Any type"
              options={LEAD_TYPES.map((t) => ({ value: t, label: humanise(t) }))}
            />
            <Select
              label="Status"
              name="status"
              defaultValue={prefill.status}
              placeholder="Any status"
              options={LEAD_STATUSES.map((t) => ({ value: t, label: humanise(t) }))}
            />
            <Select
              label="Source"
              name="source"
              defaultValue={prefill.source}
              placeholder="Any source"
              options={LEAD_SOURCES.map((t) => ({ value: t, label: humanise(t) }))}
            />
            <Select
              label="Show"
              name="showId"
              defaultValue={prefill.showId}
              placeholder="Any show"
              options={options.shows.map((s) => ({ value: s.id, label: s.title }))}
            />
            <Select
              label="Country"
              name="country"
              defaultValue={prefill.country}
              placeholder="Any country"
              options={options.countries.map((c) => ({ value: c, label: c }))}
            />
            <Select
              label="Tag"
              name="tag"
              defaultValue={prefill.tag}
              placeholder="Any tag"
              options={options.tags.map((t) => ({ value: t.name, label: t.name }))}
            />
            <Field label="Joined from" name="from" type="date" defaultValue={prefill.from} />
            <Field label="Joined to" name="to" type="date" defaultValue={prefill.to} />

            <Checkbox
              label="This is the whole list"
              name="allowEmpty"
              help="Tick only if you mean every consented contact. Guards against saving an empty filter by accident."
            />
          </CrudForm>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------- helpers */

function humanise(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

function FilterSummary({
  filter,
  showTitle,
}: {
  filter: LeadFilter;
  showTitle: (id?: string) => string | undefined;
}) {
  const parts: string[] = [];
  if (filter.type) parts.push(humanise(filter.type));
  if (filter.status) parts.push(`status ${humanise(filter.status)}`);
  if (filter.source) parts.push(`via ${humanise(filter.source)}`);
  if (filter.showId) parts.push(showTitle(filter.showId) ?? "a show");
  if (filter.country) parts.push(filter.country);
  if (filter.tag) parts.push(`tag “${filter.tag}”`);
  if (filter.q) parts.push(`matching “${filter.q}”`);
  if (filter.from) parts.push(`from ${filter.from}`);
  if (filter.to) parts.push(`to ${filter.to}`);

  if (parts.length === 0) {
    return <span className="text-admin-faint">Everyone who consented</span>;
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {parts.map((p) => (
        <span key={p} className="badge !px-2 !py-0.5">
          {p}
        </span>
      ))}
    </span>
  );
}

/** A name the team can accept or overwrite, never a blank field to stare at. */
function suggestName(filter: LeadFilter, showTitle: (id?: string) => string | undefined) {
  const bits = [
    filter.country,
    filter.type ? humanise(filter.type) + "s" : undefined,
    filter.showId ? showTitle(filter.showId) : undefined,
    filter.tag,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : undefined;
}
