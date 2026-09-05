import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { SPONSOR_TIERS } from "@/content/site";
import { saveSponsor, deleteSponsor } from "@/app/admin/content-actions";
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

const LIST = "/admin/content/sponsors";

/**
 * Tier values are stored lowercase and validated against the same three names in
 * src/app/admin/content-actions.ts. The labels come from src/content/site.ts so
 * the dashboard and the public /sponsors page cannot drift apart on what the
 * tiers are called.
 */
const TIER_OPTIONS = SPONSOR_TIERS.map((t) => ({
  value: t.name.toLowerCase(),
  label: t.name,
}));

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function SponsorsAdminPage({ searchParams }: Props) {
  const session = await requireRole("EDITOR");
  const params = await searchParams;

  const editId = one(params.edit);
  const creating = one(params.new) === "1";

  const [sponsors, editing] = await Promise.all([
    prisma.sponsor.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    editId ? prisma.sponsor.findUnique({ where: { id: editId } }) : Promise.resolve(null),
  ]);

  const showForm = creating || Boolean(editing);
  const nextOrder = sponsors.length
    ? Math.max(...sponsors.map((s) => s.sortOrder)) + 10
    : 0;
  const activeCount = sponsors.filter((s) => s.active).length;

  return (
    <>
      <AdminPageHeader
        title="Sponsors"
        description="Logos for the homepage strip and the sponsors page. Order runs low number first."
        action={
          showForm ? (
            <Link href={LIST} className="btn btn-ghost !px-5 !py-2.5 !text-xs">
              Cancel
            </Link>
          ) : (
            <Link href={`${LIST}?new=1`} className="btn btn-primary !px-6 !py-2.5 !text-xs">
              Add sponsor
            </Link>
          )
        }
      />

      {/*
        The single most likely support question on this screen. The public strip
        renders nothing at all with no active sponsors — that is deliberate, and
        the client needs to know it is not a fault before they report it as one.
      */}
      {!showForm && activeCount === 0 && sponsors.length > 0 && (
        <div className="notice mt-6">
          <p className="text-sm leading-relaxed text-admin-text">
            <span className="font-semibold text-brand-onDark">
              Nothing is showing on the public site.
            </span>{" "}
            Every sponsor below is switched off, so the &ldquo;In partnership with&rdquo; strip
            hides itself completely. Switch one to <em>Active</em> to bring the strip back.
          </p>
        </div>
      )}

      {showForm && (
        <div className="card mt-8 p-6">
          <p className="eyebrow">{editing ? "Edit sponsor" : "New sponsor"}</p>

          <div className="mt-6">
            <CrudForm
              action={saveSponsor}
              submitLabel={editing ? "Save changes" : "Add sponsor"}
              redirectTo={LIST}
            >
              {editing && <input type="hidden" name="id" value={editing.id} />}

              <Field
                label="Name"
                name="name"
                required
                defaultValue={editing?.name}
                placeholder="Acme Studios"
              />
              <Field
                label="Slug"
                name="slug"
                defaultValue={editing?.slug}
                placeholder="acme-studios"
                help="Leave blank to build one from the name. Lowercase, dashes only."
              />

              <Field
                label="Logo URL"
                name="logoUrl"
                defaultValue={editing?.logoUrl}
                placeholder="/media/sponsors/acme.webp"
                span
                help="A full https:// link or a path inside /public. Without a logo the strip falls back to the sponsor's name in display type, which still looks intentional."
              />

              <Field
                label="Website"
                name="url"
                type="url"
                defaultValue={editing?.url}
                placeholder="https://acme.example"
                help="Opens in a new tab, tagged rel=sponsored."
              />
              <Select
                label="Tier"
                name="tier"
                options={TIER_OPTIONS}
                defaultValue={editing?.tier}
                placeholder="No tier"
                help="Optional. Used to group logos on the sponsors page."
              />

              <TextArea
                label="Blurb"
                name="blurb"
                rows={3}
                defaultValue={editing?.blurb}
                help="One or two lines. Not shown on the homepage strip."
              />

              <Field
                label="Order"
                name="sortOrder"
                type="number"
                defaultValue={editing?.sortOrder ?? nextOrder}
                help="Low numbers first. Leave gaps of 10 so a logo can be slotted in later."
              />

              <Checkbox
                label="Active — show this sponsor on the public site"
                name="active"
                defaultChecked={editing ? editing.active : true}
                help="Switching off is the reversible way to remove a sponsor. Deleting is not."
              />
            </CrudForm>
          </div>
        </div>
      )}

      <div className="mt-8">
        {sponsors.length === 0 ? (
          <EmptyState
            title="No sponsors yet"
            body="Nothing is broken. The 'In partnership with' strip on the homepage hides itself entirely while there are no active sponsors, rather than rendering an empty logo row — so the site simply skips that band until the first one is added."
            action={
              <Link href={`${LIST}?new=1`} className="btn btn-primary">
                Add the first sponsor
              </Link>
            }
          />
        ) : (
          <AdminTable head={["Sponsor", "Tier", "Link", "Order", "Status", ""]}>
            {sponsors.map((s) => (
              <Row key={s.id}>
                <Cell>
                  <div className="flex items-center gap-3">
                    {s.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.logoUrl}
                        alt=""
                        className="h-7 w-auto max-w-[7rem] shrink-0 object-contain"
                      />
                    ) : (
                      <span className="badge shrink-0 !px-2 !py-0.5 !text-[9px]">No logo</span>
                    )}
                    <span className="min-w-0">
                      <Link
                        href={`${LIST}?edit=${s.id}`}
                        className="block truncate font-medium text-admin-text transition-colors hover:text-brand-onDark"
                      >
                        {s.name}
                      </Link>
                      <span className="block truncate text-xs text-admin-faint">{s.slug}</span>
                    </span>
                  </div>
                </Cell>

                <Cell muted className="capitalize">
                  {s.tier ?? "—"}
                </Cell>

                <Cell muted>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-brand-onDark"
                    >
                      {s.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  ) : (
                    "—"
                  )}
                </Cell>

                <Cell muted className="tabular-nums">
                  {s.sortOrder}
                </Cell>

                <Cell>
                  <StatusPill
                    value={s.active ? "Live" : "Hidden"}
                    tone={s.active ? "good" : "mute"}
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
                      <DeleteButton action={deleteSponsor.bind(null, s.id)} name={s.name} />
                    )}
                  </div>
                </Cell>
              </Row>
            ))}
          </AdminTable>
        )}
      </div>

      <p className="mt-6 max-w-prose text-xs leading-relaxed text-admin-faint">
        Sponsor logos are the one place on the site where a third party&apos;s brand appears.
        Only add a logo the sponsor has actually supplied or approved — a logo lifted from
        their website is a trademark use nobody has agreed to.
        {session.role !== "OWNER" && " Deleting a sponsor is restricted to the account owner."}
      </p>
    </>
  );
}
