import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mailEnabled } from "@/lib/env";
import { TEMPLATE_KEYS } from "@/lib/email-templates";
import {
  LEAD_TYPES,
  LEAD_STATUSES,
  LEAD_SOURCES,
  getFilterOptions,
  parseLeadFilter,
  isFilterActive,
} from "@/lib/admin/leads";
import { countAudience } from "@/lib/campaigns/send";
import { createCampaign } from "@/app/admin/campaign-actions";
import {
  AdminPageHeader,
  CrudForm,
  Field,
  Select,
  TextArea,
} from "@/components/admin/crud";

export const dynamic = "force-dynamic";

/**
 * The composer.
 *
 * Deliberately two steps. This page creates the draft; preview, test send,
 * schedule and send all live on the campaign's own page, because every one of
 * them needs a saved campaign to act on. A single screen that pretended
 * otherwise would either send an unsaved draft or lose the body on a failed
 * preview.
 *
 * The audience controls carry the same field names as the leads table's URL
 * params, so `/admin/campaigns/new?type=CONTESTANT&country=US` arrives
 * pre-filled straight from a view someone was already looking at.
 */

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewCampaignPage({ searchParams }: Props) {
  await requireRole("EDITOR");

  const sp = await searchParams;
  const prefill = parseLeadFilter(sp);
  const prefilledSegmentId = typeof sp.segmentId === "string" ? sp.segmentId : undefined;

  const [segments, shows, options, prefillCount, wholeList] = await Promise.all([
    prisma.segment.findMany({ orderBy: { name: "asc" } }),
    prisma.show.findMany({
      where: { status: { in: ["DRAFT", "OPEN", "LIVE", "CLOSED"] } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    getFilterOptions(),
    isFilterActive(prefill) ? countAudience(prefill) : Promise.resolve(null),
    countAudience({}),
  ]);

  const templates = (TEMPLATE_KEYS as readonly string[]).map((key) => ({
    value: key,
    label: humanise(key),
  }));

  return (
    <>
      <AdminPageHeader
        title="New campaign"
        description="Write it here, then preview, test and send from the campaign's own page."
        action={
          <Link href="/admin/campaigns" className="btn-ghost !px-5 !py-2.5 !text-xs">
            Back to campaigns
          </Link>
        }
      />

      {!mailEnabled && (
        <p className="mt-6 rounded-card border border-gold/30 bg-gold/5 p-4 text-sm text-chalk-body">
          No email provider is connected yet. You can compose and preview; sending is
          refused until <code>RESEND_API_KEY</code> is set.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <section className="card p-6">
          <CrudForm
            action={createCampaign}
            submitLabel="Create draft"
            redirectTo="/admin/campaigns"
          >
            <Field
              label="Campaign name"
              name="name"
              required
              placeholder="Drop That Mike — episode 4 announcement"
              help="Internal only. Never shown to a recipient."
            />

            <Select
              label="Template"
              name="templateKey"
              required
              options={templates}
              defaultValue={templates[0]?.value}
              placeholder="Choose a template"
            />

            <Field
              label="Subject line"
              name="subject"
              required
              span
              placeholder="{{firstName}}, {{showTitle}} goes live {{showDate}}"
              help="Personalisation tokens work here too."
            />

            <Field
              label="Preheader"
              name="preheader"
              span
              placeholder="The line inboxes show after the subject."
              help="Roughly 90 characters before Gmail truncates it."
            />

            <Select
              label="Show"
              name="showId"
              options={shows.map((s) => ({ value: s.id, label: s.title }))}
              placeholder="No show"
              help="Fills {{showTitle}}, {{showDate}} and {{prizeAmount}}."
            />

            <Select
              label="Saved segment"
              name="segmentId"
              defaultValue={prefilledSegmentId}
              placeholder="Use the one-off filter below"
              options={segments.map((s) => ({
                value: s.id,
                label:
                  s.lastCount === null
                    ? s.name
                    : `${s.name} — ${s.lastCount.toLocaleString("en-US")} recipients`,
              }))}
              help="A segment wins over the one-off filter when both are set."
            />

            <TextArea
              label="Body"
              name="bodyHtml"
              rows={14}
              placeholder={"<p>Hi {{firstName}},</p>\n<p>…</p>"}
              help="HTML, dropped into the chosen template. Tokens are escaped when they are merged, so a name with an apostrophe cannot break the markup."
            />

            {/* No control for these three, but a view arriving from the leads
                table may carry them. Hidden rather than dropped, so the audience
                the composer previewed is the audience it saves. */}
            <input type="hidden" name="q" value={prefill.q ?? ""} />
            <input type="hidden" name="from" value={prefill.from ?? ""} />
            <input type="hidden" name="to" value={prefill.to ?? ""} />

            <fieldset className="sm:col-span-2">
              <legend className="eyebrow">One-off audience</legend>
              <p className="help mb-4">
                Only used when no saved segment is chosen. Leave everything blank to reach
                every consented contact ({wholeList.mailable.toLocaleString("en-US")} right
                now).
              </p>

              <div className="grid gap-5 sm:grid-cols-2">
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
                  label="Entered for"
                  name="audienceShowId"
                  defaultValue={prefill.showId}
                  placeholder="Any show"
                  options={options.shows.map((s) => ({ value: s.id, label: s.title }))}
                  help="Filters by the show a lead entered, not the show this email is about."
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
              </div>
            </fieldset>
          </CrudForm>
        </section>

        <aside className="space-y-6">
          <div className="card p-6">
            <p className="eyebrow">Audience right now</p>
            {prefillCount ? (
              <>
                <p className="mt-3 font-display text-4xl text-metal">
                  {prefillCount.mailable.toLocaleString("en-US")}
                </p>
                <p className="mt-2 text-sm text-chalk-muted">
                  consented recipients out of {prefillCount.matching.toLocaleString("en-US")}{" "}
                  matching contacts.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 font-display text-4xl text-metal">
                  {wholeList.mailable.toLocaleString("en-US")}
                </p>
                <p className="mt-2 text-sm text-chalk-muted">
                  consented recipients on the whole list. Choose a segment or narrow the
                  filter to reduce it.
                </p>
              </>
            )}
            <p className="mt-4 text-xs text-chalk-faint">
              Counted live. The exact figure is confirmed again on the campaign page, and
              consent is re-checked once more for each recipient at the moment of sending.
            </p>
          </div>

          <div className="card p-6">
            <p className="eyebrow">Personalisation</p>
            <ul className="mt-3 space-y-2 text-sm text-chalk-muted">
              {[
                ["{{firstName}}", "Falls back to “there”"],
                ["{{showTitle}}", "From the chosen show"],
                ["{{showDate}}", "Blank until a date is confirmed"],
                ["{{prizeAmount}}", "Blank when no prize is set"],
                ["{{entryLink}}", "The public entry page"],
                ["{{unsubscribeLink}}", "Added by the template automatically"],
              ].map(([token, note]) => (
                <li key={token}>
                  <code className="text-gold">{token}</code>
                  <span className="ml-2 text-xs text-chalk-faint">{note}</span>
                </li>
              ))}
            </ul>
            <p className="help mt-4">
              An unknown token renders as nothing rather than printing itself, so a typo
              leaves a gap instead of shipping <code>{"{{frstName}}"}</code> to the list.
            </p>
          </div>

          <div className="card p-6">
            <p className="eyebrow">Segments</p>
            {segments.length === 0 ? (
              <p className="mt-3 text-sm text-chalk-muted">
                None saved yet.{" "}
                <Link href="/admin/segments" className="text-gold hover:underline">
                  Save one
                </Link>{" "}
                so the next campaign takes two clicks.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {segments.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3">
                    <span className="text-chalk-muted">{s.name}</span>
                    <span className="tabular-nums text-chalk-faint">
                      {s.lastCount === null ? "—" : s.lastCount.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function humanise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/[_-]/g, " ");
}
