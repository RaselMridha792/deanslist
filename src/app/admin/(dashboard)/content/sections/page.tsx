import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { saveSection, deleteSection } from "@/app/admin/content-actions";
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
  StatusPill,
  TextArea,
} from "@/components/admin/crud";

export const dynamic = "force-dynamic";

const LIST = "/admin/content/sections";

/**
 * The same four pages the schema documents for PageSection.page, and the same
 * four the server action validates against. Free text would let a typo create a
 * section on a page nothing reads, which looks exactly like a bug.
 */
const PAGES = [
  { value: "about", label: "About", path: "/about" },
  { value: "rules", label: "Rules & eligibility", path: "/rules" },
  { value: "sponsors", label: "Sponsors", path: "/sponsors" },
  { value: "contact", label: "Contact", path: "/contact" },
] as const;

const PAGE_OPTIONS = PAGES.map((p) => ({ value: p.value, label: p.label }));

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function excerpt(body: string, max = 110): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export default async function SectionsAdminPage({ searchParams }: Props) {
  const session = await requireRole("EDITOR");
  const params = await searchParams;

  const editId = one(params.edit);
  const creating = one(params.new) === "1";
  const presetPage = PAGES.find((p) => p.value === one(params.page))?.value;

  const [sections, editing] = await Promise.all([
    prisma.pageSection.findMany({ orderBy: [{ page: "asc" }, { sortOrder: "asc" }] }),
    editId ? prisma.pageSection.findUnique({ where: { id: editId } }) : Promise.resolve(null),
  ]);

  const showForm = creating || Boolean(editing);

  const grouped = PAGES.map((p) => ({
    ...p,
    rows: sections.filter((s) => s.page === p.value),
  })).filter((g) => g.rows.length > 0);

  // Sections stored against a page that is no longer in the list above would
  // otherwise vanish from this screen entirely.
  const orphans = sections.filter((s) => !PAGES.some((p) => p.value === s.page));

  const nextOrder = (page: string) => {
    const rows = sections.filter((s) => s.page === page);
    return rows.length ? Math.max(...rows.map((s) => s.sortOrder)) + 10 : 0;
  };

  return (
    <>
      <AdminPageHeader
        title="Page sections"
        description="Copy blocks for the pages the client writes themselves. Plain text — line breaks are kept, formatting marks are not."
        action={
          showForm ? (
            <Link href={LIST} className="btn btn-ghost !px-5 !py-2.5 !text-xs">
              Cancel
            </Link>
          ) : (
            <Link href={`${LIST}?new=1`} className="btn btn-primary !px-6 !py-2.5 !text-xs">
              New section
            </Link>
          )
        }
      />

      <div className="mt-6 border border-admin-line-strong bg-admin-panel p-6">
        <p className="eyebrow">Before you write</p>
        <ul className="mt-4 max-w-prose space-y-3 text-sm leading-relaxed text-admin-muted">
          <li>
            <span className="text-admin-text">Draft is the default.</span> A section is invisible to
            visitors until <em>Published</em> is ticked, so half-written copy is safe to save.
          </li>
          <li>
            <span className="text-admin-text">One section per key, per page.</span> Reusing a key on
            the same page is rejected — edit the existing section instead.
          </li>
          <li>
            <span className="text-admin-text">/rules is not in Google yet.</span> It carries a
            noindex tag and ships an honest outline of what the rules will cover, because
            contest rules are a legal document and nothing there is drafted on the
            client&apos;s behalf. The tag comes off once the official wording is published
            here.
          </li>
          <li>
            <span className="text-admin-text">Not yet wired to the public pages.</span> /about and
            /rules still render their built-in copy, so a section saved today is stored and
            ready rather than live. Writing it now is what unblocks the switch-over.
          </li>
        </ul>
      </div>

      {showForm && (
        <div className="card mt-6 p-6">
          <p className="eyebrow">{editing ? "Edit section" : "New section"}</p>

          <div className="mt-6">
            <CrudForm
              action={saveSection}
              submitLabel={editing ? "Save changes" : "Create section"}
              redirectTo={LIST}
            >
              {editing && <input type="hidden" name="id" value={editing.id} />}

              <Select
                label="Page"
                name="page"
                required
                options={PAGE_OPTIONS}
                defaultValue={editing?.page ?? presetPage}
                placeholder="Choose a page"
                help="Where this block belongs."
              />

              <Field
                label="Key"
                name="key"
                required
                defaultValue={editing?.key}
                placeholder="eligibility"
                help="Permanent identifier, unique within the page. Lowercase, dashes only."
              />

              <Field
                label="Heading"
                name="heading"
                defaultValue={editing?.heading}
                placeholder="Who can enter"
                span
                help="Optional. Leave blank for a block of copy with no heading above it."
              />

              <TextArea
                label="Body"
                name="body"
                required
                rows={16}
                defaultValue={editing?.body}
                placeholder="Write the copy exactly as it should read on the page."
                help="Plain text. Blank lines separate paragraphs; there is no bold, italic or link formatting, so write anything legal in full sentences rather than relying on emphasis."
              />

              <Field
                label="Order"
                name="sortOrder"
                type="number"
                defaultValue={editing?.sortOrder ?? nextOrder(editing?.page ?? presetPage ?? "about")}
                help="Low numbers first, top to bottom on the page."
              />

              <Checkbox
                label="Published — show this section to visitors"
                name="published"
                defaultChecked={editing ? editing.published : false}
                help="Leave unticked while the wording is still being agreed."
              />
            </CrudForm>
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No sections written yet"
            body="Nothing is missing. Each public page falls back to the copy that ships with the site, and a section written here replaces that block once it is published. The rules page is the one waiting on the client — it is noindex until the official wording lands."
            action={
              <Link href={`${LIST}?new=1&page=rules`} className="btn btn-primary">
                Start the rules copy
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {grouped.map((g) => (
            <section key={g.value}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-xl uppercase tracking-wide text-admin-text">
                  {g.label}
                </h2>
                <div className="flex items-center gap-4">
                  <Link
                    href={g.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
                  >
                    View {g.path}
                  </Link>
                  <Link
                    href={`${LIST}?new=1&page=${g.value}`}
                    className="text-xs font-semibold uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
                  >
                    Add here
                  </Link>
                </div>
              </div>

              <div className="mt-4">
                <AdminTable head={["Section", "Preview", "Order", "Status", ""]}>
                  {g.rows.map((s) => (
                    <Row key={s.id}>
                      <Cell>
                        <Link
                          href={`${LIST}?edit=${s.id}`}
                          className="block font-medium text-admin-text transition-colors hover:text-brand-onDark"
                        >
                          {s.heading || <span className="text-admin-muted">No heading</span>}
                        </Link>
                        <span className="block font-mono text-xs text-admin-faint">{s.key}</span>
                      </Cell>
                      <Cell muted className="max-w-md">
                        <span className="block truncate">{excerpt(s.body)}</span>
                        <span className="mt-1 block text-[11px] text-admin-faint">
                          {s.body.length.toLocaleString("en-US")} characters · updated{" "}
                          {s.updatedAt.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </Cell>
                      <Cell muted className="tabular-nums">
                        {s.sortOrder}
                      </Cell>
                      <Cell>
                        <StatusPill
                          value={s.published ? "Published" : "Draft"}
                          tone={s.published ? "good" : "mute"}
                        />
                      </Cell>
                      <Cell>
                        <div className="flex items-center justify-end gap-4">
                          <Link
                            href={`${LIST}?edit=${s.id}`}
                            className="text-xs font-semibold uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
                          >
                            Edit
                          </Link>
                          {session.role === "OWNER" && (
                            <DeleteButton
                              action={deleteSection.bind(null, s.id)}
                              name={s.heading || s.key}
                            />
                          )}
                        </div>
                      </Cell>
                    </Row>
                  ))}
                </AdminTable>
              </div>
            </section>
          ))}

          {orphans.length > 0 && (
            <section>
              <h2 className="font-display text-xl uppercase tracking-wide text-admin-text">
                Unassigned
              </h2>
              <p className="mt-2 max-w-prose text-sm text-admin-muted">
                These are stored against a page that is not in the list above, so nothing on the
                site will ever render them. Move each one to a real page or delete it.
              </p>
              <div className="mt-4">
                <AdminTable head={["Page", "Section", "Status", ""]}>
                  {orphans.map((s) => (
                    <Row key={s.id}>
                      <Cell muted className="font-mono text-xs">
                        {s.page}
                      </Cell>
                      <Cell>
                        <Link
                          href={`${LIST}?edit=${s.id}`}
                          className="font-medium text-admin-text transition-colors hover:text-brand-onDark"
                        >
                          {s.heading || s.key}
                        </Link>
                      </Cell>
                      <Cell>
                        <StatusPill value="Not rendered" tone="warn" />
                      </Cell>
                      <Cell>
                        <div className="flex items-center justify-end gap-4">
                          <Link
                            href={`${LIST}?edit=${s.id}`}
                            className="text-xs font-semibold uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
                          >
                            Edit
                          </Link>
                          {session.role === "OWNER" && (
                            <DeleteButton
                              action={deleteSection.bind(null, s.id)}
                              name={s.heading || s.key}
                            />
                          )}
                        </div>
                      </Cell>
                    </Row>
                  ))}
                </AdminTable>
              </div>
            </section>
          )}
        </div>
      )}

      {session.role !== "OWNER" && (
        <p className="mt-8 text-xs text-admin-faint">
          Deleting a section is restricted to the account owner. Untick <em>Published</em> to
          take one off the site.
        </p>
      )}
    </>
  );
}
