import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mailEnabled } from "@/lib/env";
import { TEMPLATE_KEYS } from "@/lib/email-templates";
import {
  LEAD_TYPES,
  LEAD_STATUSES,
  LEAD_SOURCES,
  getFilterOptions,
  filterToQuery,
  type LeadFilter,
} from "@/lib/admin/leads";
import {
  SKIP_PREFIX,
  campaignFilter,
  countAudience,
  isSkip,
  loadCampaign,
  renderCampaignPreview,
} from "@/lib/campaigns/send";
import {
  updateCampaign,
  sendTest,
  scheduleCampaign,
  sendCampaignNow,
  unscheduleCampaign,
  recountCampaignAudience,
  deleteCampaign,
} from "@/app/admin/campaign-actions";
import {
  AdminPageHeader,
  AdminTable,
  Cell,
  CrudForm,
  DeleteButton,
  Field,
  Row,
  RowLink,
  Select,
  StatusPill,
  TextArea,
} from "@/components/admin/crud";

export const dynamic = "force-dynamic";

/**
 * One campaign: edit it, preview it, test it, send it, then read what happened.
 *
 * The order on the page is the order of the job. Everything above the reporting
 * block disappears once the campaign is sent, because the content of a sent
 * campaign is a record of what went out and editing it would make the numbers
 * below describe an email nobody received.
 */

const ROWS_PER_PAGE = 100;

const SEND_TONE: Record<string, "good" | "warn" | "mute"> = {
  SENT: "good",
  OPENED: "good",
  CLICKED: "good",
  QUEUED: "warn",
  BOUNCED: "mute",
  FAILED: "mute",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CampaignDetailPage({ params, searchParams }: Props) {
  await requireRole("EDITOR");

  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);

  const campaign = await loadCampaign(id);
  if (!campaign) notFound();

  const editable = campaign.status === "DRAFT" || campaign.status === "SCHEDULED";
  const filter = campaignFilter(campaign);

  const [
    options,
    shows,
    segments,
    audience,
    grouped,
    delivered,
    openedUnique,
    clickedUnique,
    skipped,
    opensTotal,
    clicksTotal,
    recipients,
    recipientTotal,
  ] = await Promise.all([
    getFilterOptions(),
    prisma.show.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.segment.findMany({ orderBy: { name: "asc" } }),
    countAudience(filter),
    prisma.campaignSend.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: { _all: true },
    }),
    prisma.campaignSend.count({ where: { campaignId: id, deliveredAt: { not: null } } }),
    prisma.campaignSend.count({ where: { campaignId: id, openedAt: { not: null } } }),
    prisma.campaignSend.count({ where: { campaignId: id, clickedAt: { not: null } } }),
    prisma.campaignSend.count({
      where: { campaignId: id, status: "FAILED", error: { startsWith: SKIP_PREFIX } },
    }),
    prisma.campaignSend.aggregate({ where: { campaignId: id }, _sum: { openCount: true } }),
    prisma.campaignSend.aggregate({ where: { campaignId: id }, _sum: { clickCount: true } }),
    prisma.campaignSend.findMany({
      where: { campaignId: id },
      orderBy: [{ sentAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * ROWS_PER_PAGE,
      take: ROWS_PER_PAGE,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.campaignSend.count({ where: { campaignId: id } }),
  ]);

  const by = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const sent = by("SENT") + by("OPENED") + by("CLICKED") + by("BOUNCED");
  const failed = by("FAILED") - skipped;
  const queued = by("QUEUED");
  const bounced = by("BOUNCED");

  // A template that throws must not take the whole page down — the team still
  // needs to see the reporting.
  let preview: { subject: string; html: string; text: string } | null = null;
  let previewError: string | null = null;
  try {
    preview = renderCampaignPreview(campaign);
  } catch (err) {
    previewError = err instanceof Error ? err.message : "Preview failed";
  }

  const pages = Math.max(1, Math.ceil(recipientTotal / ROWS_PER_PAGE));
  const templates = (TEMPLATE_KEYS as readonly string[]).map((k) => ({
    value: k,
    label: humanise(k),
  }));

  return (
    <>
      <AdminPageHeader
        title={campaign.name}
        description={campaign.subject}
        action={
          <div className="flex items-center gap-3">
            <StatusPill
              value={campaign.status}
              tone={campaign.status === "SENT" ? "good" : campaign.status === "DRAFT" ? "mute" : "warn"}
            />
            <Link href="/admin/campaigns" className="btn btn-ghost !px-5 !py-2.5 !text-xs">
              All campaigns
            </Link>
          </div>
        }
      />

      {/* ------------------------------------------------------- reporting */}

      <section className="mt-8">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
          <Metric label="Recipients" value={recipientTotal || audience.mailable} />
          <Metric label="Sent" value={sent} />
          <Metric label="Delivered" value={delivered} of={sent} />
          <Metric label="Opened" value={openedUnique} of={delivered || sent} />
          <Metric label="Clicked" value={clickedUnique} of={delivered || sent} />
          <Metric label="Bounced" value={bounced} accent={bounced > 0} />
          <Metric label="Failed" value={failed} accent={failed > 0} />
        </div>

        {(queued > 0 || skipped > 0) && (
          <p className="mt-3 text-xs text-admin-faint">
            {queued > 0 && (
              <span className="mr-4">
                {queued.toLocaleString("en-US")} still queued — the send resumes on the next
                tick.
              </span>
            )}
            {skipped > 0 && (
              <span>
                {skipped.toLocaleString("en-US")} skipped at send time (suppressed,
                unsubscribed, or no longer opted in). Counted separately from failures.
              </span>
            )}
          </p>
        )}

        {(opensTotal._sum.openCount ?? 0) > openedUnique && (
          <p className="mt-2 text-xs text-admin-faint">
            {(opensTotal._sum.openCount ?? 0).toLocaleString("en-US")} opens and{" "}
            {(clicksTotal._sum.clickCount ?? 0).toLocaleString("en-US")} clicks in total,
            counting repeats. Open tracking is approximate — image proxies inflate it and
            privacy settings hide it.
          </p>
        )}
      </section>

      {/* -------------------------------------------------------- audience */}

      <section className="mt-8 card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Audience</p>
            <p className="mt-2 text-sm text-admin-text">
              {campaign.segment ? (
                <>
                  Segment <span className="text-admin-text">{campaign.segment.name}</span>
                </>
              ) : (
                <FilterSummary filter={filter} shows={options.shows} />
              )}
            </p>
            <Link
              href={`/admin/leads${filterToQuery({ ...filter, optIn: "yes" })}`}
              className="mt-2 inline-block text-[11px] uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
            >
              Open these contacts in leads
            </Link>
          </div>

          <div className="text-right">
            <p className="font-display text-3xl text-brand-onDark">
              {audience.mailable.toLocaleString("en-US")}
            </p>
            <p className="text-xs text-admin-faint">
              consented, of {audience.matching.toLocaleString("en-US")} matching
            </p>
            {editable && (
              <form
                action={async () => {
                  "use server";
                  await recountCampaignAudience(campaign.id);
                }}
              >
                <button
                  type="submit"
                  className="mt-2 text-[11px] uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
                >
                  Recount
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- actions */}

      {editable && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="card p-6">
            <p className="eyebrow">Send a test</p>
            <p className="mt-2 text-sm text-admin-muted">
              One message to one address, rendered by the same code path as the real send.
            </p>
            <div className="mt-4">
              <CrudForm action={sendTest} submitLabel="Send test">
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Field label="To" name="to" type="email" required span placeholder="you@example.com" />
              </CrudForm>
            </div>
          </div>

          <div className="card p-6">
            <p className="eyebrow">Schedule</p>
            <p className="mt-2 text-sm text-admin-muted">
              {campaign.scheduledFor
                ? `Scheduled for ${formatDate(campaign.scheduledFor)}. A timer fires it unattended.`
                : "Pick a time and the job runner sends it without anyone present."}
            </p>
            <div className="mt-4">
              <CrudForm action={scheduleCampaign} submitLabel="Schedule">
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Field
                  label="Send at"
                  name="scheduledFor"
                  type="datetime-local"
                  required
                  span
                  defaultValue={toLocalInput(campaign.scheduledFor)}
                  help="Server time."
                />
              </CrudForm>
            </div>
            {campaign.status === "SCHEDULED" && (
              <form
                action={async () => {
                  "use server";
                  await unscheduleCampaign(campaign.id);
                }}
              >
                <button
                  type="submit"
                  className="mt-4 text-xs font-semibold uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
                >
                  Cancel schedule
                </button>
              </form>
            )}
          </div>

          <div className="notice-strong p-6">
            <p className="eyebrow text-brand-onDark">Send now</p>
            <p className="mt-2 text-sm text-admin-muted">
              Queues the send immediately. There is no recall — the only stop is the
              recipient&apos;s inbox.
            </p>
            <p className="mt-3 text-sm text-admin-text">
              Going to{" "}
              <span className="font-semibold text-admin-text">
                {audience.mailable.toLocaleString("en-US")}
              </span>{" "}
              people.
            </p>
            <div className="mt-4">
              {mailEnabled ? (
                <DeleteButton
                  action={sendCampaignNow.bind(null, campaign.id)}
                  name={campaign.name}
                  label="Send now"
                />
              ) : (
                <p className="error-text">
                  No email provider is connected. Set RESEND_API_KEY first.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- preview */}

      <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
        <div className="card p-6">
          <p className="eyebrow">Preview</p>
          <p className="mt-2 text-sm text-admin-muted">
            Rendered with sample data. <span className="text-admin-text">Subject:</span>{" "}
            {preview?.subject || campaign.subject}
          </p>
          {previewError ? (
            <p className="error-text mt-4">Preview failed: {previewError}</p>
          ) : (
            <iframe
              title="Email preview"
              // sandbox="" strips scripts. An email client would too, and the
              // body is HTML an editor typed.
              sandbox=""
              srcDoc={preview?.html ?? ""}
              className="mt-4 h-[640px] w-full border border-admin-line bg-white"
            />
          )}
          {preview?.text && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs uppercase tracking-widest text-admin-faint">
                Plain text alternative
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap border border-admin-line-strong bg-admin-raised p-4 text-xs text-admin-muted">
                {preview.text}
              </pre>
            </details>
          )}
        </div>

        {editable ? (
          <div className="card p-6">
            <p className="eyebrow">Edit</p>
            <div className="mt-4">
              <CrudForm action={updateCampaign} submitLabel="Save changes">
                <input type="hidden" name="id" value={campaign.id} />

                <Field label="Campaign name" name="name" required defaultValue={campaign.name} />
                <Select
                  label="Template"
                  name="templateKey"
                  required
                  options={templates}
                  defaultValue={campaign.templateKey ?? templates[0]?.value}
                  placeholder="Choose a template"
                />
                <Field label="Subject line" name="subject" required span defaultValue={campaign.subject} />
                <Field label="Preheader" name="preheader" span defaultValue={campaign.preheader} />

                <Select
                  label="Show"
                  name="showId"
                  defaultValue={campaign.showId}
                  placeholder="No show"
                  options={shows.map((s) => ({ value: s.id, label: s.title }))}
                />
                <Select
                  label="Saved segment"
                  name="segmentId"
                  defaultValue={campaign.segmentId}
                  placeholder="Use the one-off filter"
                  options={segments.map((s) => ({
                    value: s.id,
                    label:
                      s.lastCount === null
                        ? s.name
                        : `${s.name} — ${s.lastCount.toLocaleString("en-US")}`,
                  }))}
                />

                <TextArea
                  label="Body"
                  name="bodyHtml"
                  rows={12}
                  defaultValue={campaign.bodyHtml}
                  help="Tokens: {{firstName}} {{showTitle}} {{showDate}} {{prizeAmount}} {{entryLink}}"
                />

                {/* Carried through the edit rather than silently dropped:
                    filterFromForm rebuilds the whole filter from this form. */}
                <input type="hidden" name="q" value={filter.q ?? ""} />
                <input type="hidden" name="from" value={filter.from ?? ""} />
                <input type="hidden" name="to" value={filter.to ?? ""} />

                <fieldset className="sm:col-span-2">
                  <legend className="eyebrow">One-off audience</legend>
                  <p className="help mb-4">Ignored when a saved segment is selected.</p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Select
                      label="Type"
                      name="type"
                      defaultValue={filter.type}
                      placeholder="Any type"
                      options={LEAD_TYPES.map((t) => ({ value: t, label: humanise(t) }))}
                    />
                    <Select
                      label="Status"
                      name="status"
                      defaultValue={filter.status}
                      placeholder="Any status"
                      options={LEAD_STATUSES.map((t) => ({ value: t, label: humanise(t) }))}
                    />
                    <Select
                      label="Source"
                      name="source"
                      defaultValue={filter.source}
                      placeholder="Any source"
                      options={LEAD_SOURCES.map((t) => ({ value: t, label: humanise(t) }))}
                    />
                    <Select
                      label="Entered for"
                      name="audienceShowId"
                      defaultValue={filter.showId}
                      placeholder="Any show"
                      options={options.shows.map((s) => ({ value: s.id, label: s.title }))}
                    />
                    <Select
                      label="Country"
                      name="country"
                      defaultValue={filter.country}
                      placeholder="Any country"
                      options={options.countries.map((c) => ({ value: c, label: c }))}
                    />
                    <Select
                      label="Tag"
                      name="tag"
                      defaultValue={filter.tag}
                      placeholder="Any tag"
                      options={options.tags.map((t) => ({ value: t.name, label: t.name }))}
                    />
                  </div>
                </fieldset>
              </CrudForm>
            </div>

            <div className="mt-8 border-t border-admin-line pt-6">
              <DeleteButton
                action={deleteCampaign.bind(null, campaign.id)}
                name={campaign.name}
                label="Delete campaign"
                redirectTo="/admin/campaigns"
              />
            </div>
          </div>
        ) : (
          <div className="card p-6">
            <p className="eyebrow">Locked</p>
            <p className="mt-2 text-sm text-admin-muted">
              This campaign is {campaign.status.toLowerCase()}. Its content is now the record
              of what went out, so it can no longer be edited — the numbers above have to
              describe the email people actually received.
            </p>
            {campaign.sentAt && (
              <p className="mt-4 text-sm text-admin-text">
                Sent {formatDate(campaign.sentAt)}.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- recipients */}

      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-wide">Recipients</h2>
        <p className="mt-2 text-sm text-admin-muted">
          One row per person, with what the provider reported back.
        </p>

        <div className="mt-5">
          {recipients.length === 0 ? (
            <p className="border border-dashed border-admin-line-strong bg-admin-panel p-10 text-center text-sm text-admin-muted">
              No recipient rows yet. They are created in full the moment a send starts, which
              is what makes an interrupted send resumable instead of duplicated.
            </p>
          ) : (
            <AdminTable head={["Recipient", "Status", "Sent", "Delivered", "Opened", "Clicked", "Note"]}>
              {recipients.map((r) => (
                <Row key={r.id}>
                  <Cell>
                    <RowLink href={`/admin/leads/${r.lead.id}`}>
                      {r.lead.firstName} {r.lead.lastName ?? ""}
                    </RowLink>
                    <span className="mt-1 block truncate text-xs text-admin-faint">
                      {r.lead.email}
                    </span>
                  </Cell>
                  <Cell>
                    <StatusPill
                      value={isSkip(r.error) ? "SKIPPED" : r.status}
                      tone={isSkip(r.error) ? "mute" : SEND_TONE[r.status] ?? "mute"}
                    />
                  </Cell>
                  <Cell muted className="whitespace-nowrap text-xs">
                    {shortDate(r.sentAt)}
                  </Cell>
                  <Cell muted className="whitespace-nowrap text-xs">
                    {shortDate(r.deliveredAt)}
                  </Cell>
                  <Cell muted className="whitespace-nowrap text-xs">
                    {r.openCount > 0 ? `${r.openCount}×` : shortDate(r.openedAt)}
                  </Cell>
                  <Cell muted className="whitespace-nowrap text-xs">
                    {r.clickCount > 0 ? `${r.clickCount}×` : shortDate(r.clickedAt)}
                  </Cell>
                  <Cell muted className="max-w-[18rem] truncate text-xs">
                    {r.error ? r.error.replace(SKIP_PREFIX, "").trim() : "—"}
                  </Cell>
                </Row>
              ))}
            </AdminTable>
          )}
        </div>

        {pages > 1 && (
          <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
            <p className="text-admin-faint">
              Page {page} of {pages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/campaigns/${campaign.id}?page=${page - 1}`}
                  className="btn btn-ghost !px-4 !py-2 !text-xs"
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={`/admin/campaigns/${campaign.id}?page=${page + 1}`}
                  className="btn btn-ghost !px-4 !py-2 !text-xs"
                >
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------- helpers */

function Metric({
  label,
  value,
  of,
  accent,
}: {
  label: string;
  value: number;
  of?: number;
  accent?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-[11px] uppercase tracking-widest text-admin-faint">{label}</p>
      <p
        className={`mt-1.5 font-display text-3xl ${
          accent ? "text-brand-onDark" : "text-admin-text"
        }`}
      >
        {value.toLocaleString("en-US")}
      </p>
      {of !== undefined && of > 0 && (
        <p className="mt-0.5 text-[11px] text-admin-faint">
          {Math.round((value / of) * 100)}%
        </p>
      )}
    </div>
  );
}

function FilterSummary({
  filter,
  shows,
}: {
  filter: LeadFilter;
  shows: { id: string; title: string }[];
}) {
  const parts: string[] = [];
  if (filter.type) parts.push(humanise(filter.type));
  if (filter.status) parts.push(`status ${humanise(filter.status)}`);
  if (filter.source) parts.push(`via ${humanise(filter.source)}`);
  if (filter.showId) parts.push(shows.find((s) => s.id === filter.showId)?.title ?? "a show");
  if (filter.country) parts.push(filter.country);
  if (filter.tag) parts.push(`tag “${filter.tag}”`);
  if (filter.q) parts.push(`matching “${filter.q}”`);

  if (parts.length === 0) return <>Everyone who consented to marketing email</>;
  return <>One-off filter: {parts.join(" · ")}</>;
}

function humanise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/[_-]/g, " ");
}

function formatDate(d: Date) {
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * datetime-local wants "YYYY-MM-DDTHH:mm". The identical helper in crud.tsx
 * cannot be called from here: that module is "use client", so every one of its
 * exports arrives in a Server Component as a client reference rather than a
 * callable function.
 */
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
