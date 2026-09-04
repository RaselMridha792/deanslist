import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getLead } from "@/lib/admin/leads";
import { extractYouTubeId } from "@/lib/queries";
import { LeadDetailPanel } from "@/components/admin/LeadDetailPanel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function LeadDetailPage({ params }: Props) {
  await requireRole("REVIEWER");
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const youTubeId = extractYouTubeId(lead.performanceUrl);
  const facebookVideo =
    lead.performanceUrl && /facebook\.com|fb\.watch/i.test(lead.performanceUrl)
      ? lead.performanceUrl
      : null;

  return (
    <>
      <Link href="/admin/leads" className="btn-quiet">
        ← Back to leads
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide">
            {lead.firstName} {lead.lastName ?? ""}
          </h1>
          <p className="mt-2 text-sm text-chalk-muted">
            {lead.type.charAt(0) + lead.type.slice(1).toLowerCase()} ·{" "}
            {lead.source.replace(/_/g, " ").toLowerCase()} ·{" "}
            {lead.createdAt.toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-10 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          {/* The performance is the whole point of a contestant entry, so it
              leads rather than sitting below a field list. */}
          {lead.performanceUrl && (
            <section>
              <p className="label">Performance</p>
              {youTubeId ? (
                <div className="aspect-video overflow-hidden rounded-card border border-ink-line">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${youTubeId}`}
                    title="Submitted performance"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <div className="rounded-card border border-ink-line bg-ink-soft p-5">
                  <p className="text-sm text-chalk-muted">
                    {facebookVideo
                      ? "Facebook video — open in a new tab to watch."
                      : "Link submitted. Open it to review."}
                  </p>
                </div>
              )}
              <a
                href={lead.performanceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block break-all text-sm text-brand hover:underline"
              >
                {lead.performanceUrl}
              </a>
            </section>
          )}

          <section>
            <p className="label">Submitted details</p>
            <dl className="grid gap-px overflow-hidden rounded-card border border-ink-line bg-ink-line sm:grid-cols-2">
              <Field label="Email" value={lead.email} href={`mailto:${lead.email}`} />
              <Field label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
              <Field label="Address" value={lead.addressLine1} />
              <Field label="Address line 2" value={lead.addressLine2} />
              <Field label="City" value={lead.city} />
              <Field label="State / region" value={lead.state} />
              <Field label="Postcode" value={lead.postalCode} />
              <Field label="Country" value={lead.country} />
              <Field label="Stage name" value={lead.stageName} />
              <Field label="Talent category" value={lead.talentCategory} />
              <Field label="Age range" value={lead.ageRange} />
              <Field label="Show" value={lead.show?.title ?? null} />
              <Field
                label="Marketing consent"
                value={
                  lead.marketingOptIn
                    ? `Yes${lead.consentAt ? ` · ${lead.consentAt.toLocaleDateString("en-GB")}` : ""}`
                    : "No"
                }
              />
              <Field label="Unsubscribed" value={lead.unsubscribedAt ? "Yes" : "No"} />
            </dl>
          </section>

          {lead.message && (
            <section>
              <p className="label">Their message</p>
              <div className="whitespace-pre-wrap rounded-card border border-ink-line bg-ink-soft p-5 text-sm leading-relaxed text-chalk-body">
                {lead.message}
              </div>
            </section>
          )}

          {lead.conversations.length > 0 && (
            <section>
              <p className="label">Chatbot transcript</p>
              <div className="space-y-3 rounded-card border border-ink-line bg-ink-soft p-5">
                {lead.conversations.flatMap((c) =>
                  c.messages.map((m) => (
                    <p key={m.id} className="text-sm">
                      <span className="text-xs uppercase tracking-widest text-chalk-faint">
                        {m.role}
                      </span>
                      <br />
                      <span className="text-chalk-body">{m.content}</span>
                    </p>
                  )),
                )}
              </div>
            </section>
          )}

          {/* Kept in a collapsed block: useful when investigating spam, noise
              the rest of the time. */}
          <details className="rounded-card border border-ink-line bg-ink-soft p-5">
            <summary className="cursor-pointer text-xs uppercase tracking-widest text-chalk-faint">
              Technical detail
            </summary>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <Raw label="IP address" value={lead.ipAddress} />
              <Raw label="Referrer" value={lead.referrer} />
              <Raw label="UTM source" value={lead.utmSource} />
              <Raw label="UTM medium" value={lead.utmMedium} />
              <Raw label="UTM campaign" value={lead.utmCampaign} />
              <Raw label="User agent" value={lead.userAgent} />
            </dl>
          </details>
        </div>

        <aside className="rounded-card border border-ink-line bg-ink-soft p-6">
          <LeadDetailPanel
            leadId={lead.id}
            status={lead.status}
            notes={lead.internalNotes ?? ""}
            tags={lead.tags.map((t) => ({ id: t.tag.id, name: t.tag.name }))}
          />
        </aside>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div className="bg-ink-soft px-5 py-4">
      <dt className="text-[10px] uppercase tracking-widest text-chalk-faint">{label}</dt>
      <dd className="mt-1 break-words text-sm text-chalk-body">
        {value ? (
          href ? (
            <a href={href} className="text-brand hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-chalk-ghost">—</span>
        )}
      </dd>
    </div>
  );
}

function Raw({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-chalk-faint">{label}</dt>
      <dd className="mt-0.5 break-all text-chalk-muted">{value ?? "—"}</dd>
    </div>
  );
}
