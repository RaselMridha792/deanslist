import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { LeadFilters } from "@/components/admin/LeadFilters";
import { LeadTable } from "@/components/admin/LeadTable";
import {
  parseLeadFilter,
  findLeads,
  getFilterOptions,
  filterToQuery,
} from "@/lib/admin/leads";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LeadsPage({ searchParams }: Props) {
  await requireRole("REVIEWER");

  const filter = parseLeadFilter(await searchParams);
  const [{ rows, total, page, pages }, options] = await Promise.all([
    findLeads(filter),
    getFilterOptions(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide">Leads &amp; Entries</h1>
          <p className="mt-2 text-sm text-chalk-muted">
            Every submission from every form, in the client&apos;s own database.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <LeadFilters
          shows={options.shows}
          countries={options.countries}
          tags={options.tags}
          total={total}
        />
      </div>

      <div className="mt-6">
        <LeadTable
          rows={rows.map((r) => ({
            id: r.id,
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email,
            type: r.type,
            status: r.status,
            country: r.country,
            talentCategory: r.talentCategory,
            createdAt: r.createdAt.toISOString(),
            marketingOptIn: r.marketingOptIn,
            show: r.show ? { title: r.show.title } : null,
            tags: r.tags.map((t) => ({ tag: { id: t.tag.id, name: t.tag.name } })),
          }))}
        />
      </div>

      {pages > 1 && (
        <nav
          className="mt-6 flex items-center justify-between text-sm"
          aria-label="Pagination"
        >
          <p className="text-chalk-faint">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/leads${filterToQuery(filter, { page: page - 1 })}`}
                className="btn btn-ghost !px-4 !py-2 !text-xs"
              >
                Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/admin/leads${filterToQuery(filter, { page: page + 1 })}`}
                className="btn btn-ghost !px-4 !py-2 !text-xs"
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
