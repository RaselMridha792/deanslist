import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env, mailEnabled } from "@/lib/env";
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
 * Campaign list.
 *
 * The banner at the top is not decoration. A campaign system has two silent
 * failure modes — no email provider, and no timer calling the tick — and both
 * look exactly like "nothing happened". Surfacing them here is the difference
 * between a scheduled send that fires and one that sits in the table forever.
 */

const STATUS_TONE: Record<string, "good" | "warn" | "mute"> = {
  SENT: "good",
  SENDING: "warn",
  SCHEDULED: "warn",
  DRAFT: "mute",
  FAILED: "mute",
};

export default async function CampaignsPage() {
  await requireRole("EDITOR");

  const [campaigns, pendingJobs, failedJobs, lastDoneJob] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: { segment: { select: { name: true } }, show: { select: { title: true } } },
    }),
    prisma.job.count({ where: { status: "PENDING" } }),
    prisma.job.count({ where: { status: "FAILED" } }),
    prisma.job.findFirst({
      where: { finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);

  const schedulerSilent =
    !lastDoneJob?.finishedAt ||
    Date.now() - lastDoneJob.finishedAt.getTime() > 24 * 60 * 60 * 1000;

  return (
    <>
      <AdminPageHeader
        title="Campaigns"
        description="Announcements and reminders to a saved audience. Every send is logged per recipient."
        action={
          <Link href="/admin/campaigns/new" className="btn btn-primary !px-6 !py-3 !text-xs">
            New campaign
          </Link>
        }
      />

      {!mailEnabled && (
        <p className="mt-6 border border-brand/40 bg-brand/10 p-4 text-sm text-ink">
          <span className="font-semibold text-brand-onLight">
            No email provider is connected.
          </span>{" "}
          Campaigns can be composed and previewed, but a send will be refused rather than
          quietly reporting success it did not achieve. Set <code>RESEND_API_KEY</code>.
        </p>
      )}

      {!env.CRON_SECRET && (
        <p className="mt-4 border border-brand/30 bg-brand/5 p-4 text-sm text-ink">
          <span className="font-semibold text-brand">The scheduler is not configured.</span>{" "}
          Set <code>CRON_SECRET</code> and point a timer at{" "}
          <code>GET /api/cron/tick</code>, or a scheduled campaign will never fire.
        </p>
      )}

      {env.CRON_SECRET && schedulerSilent && (
        <p className="mt-4 border border-brand/30 bg-brand/5 p-4 text-sm text-ink">
          <span className="font-semibold text-brand">
            The scheduler has not run in the last 24 hours.
          </span>{" "}
          Check the systemd timer or PM2 cron that calls <code>/api/cron/tick</code>.
        </p>
      )}

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Queued jobs" value={pendingJobs} />
        <Stat label="Failed jobs" value={failedJobs} accent={failedJobs > 0} />
        <Stat
          label="Last job finished"
          text={
            lastDoneJob?.finishedAt
              ? lastDoneJob.finishedAt.toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never"
          }
        />
      </dl>

      <div className="mt-8">
        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            body="A campaign is a subject line, a template, and an audience. Save a segment first if you want to reach a specific group."
            action={
              <Link href="/admin/campaigns/new" className="btn btn-primary !px-6 !py-3 !text-xs">
                Compose the first one
              </Link>
            }
          />
        ) : (
          <AdminTable
            head={["Campaign", "Audience", "Status", "Sent", "Opened", "Clicked", "When"]}
          >
            {campaigns.map((c) => (
              <Row key={c.id}>
                <Cell>
                  <RowLink href={`/admin/campaigns/${c.id}`}>{c.name}</RowLink>
                  <span className="mt-1 block truncate text-xs text-neutral-600">
                    {c.subject}
                  </span>
                </Cell>

                <Cell muted>
                  {c.segment?.name ?? "One-off filter"}
                  {c.show && (
                    <span className="mt-1 block text-[11px] text-neutral-400">
                      {c.show.title}
                    </span>
                  )}
                </Cell>

                <Cell>
                  <StatusPill value={c.status} tone={STATUS_TONE[c.status] ?? "mute"} />
                </Cell>

                <Cell muted className="tabular-nums">
                  {c.totalSent.toLocaleString("en-US")}
                  <span className="block text-[11px] text-neutral-400">
                    of {c.totalRecipients.toLocaleString("en-US")}
                  </span>
                </Cell>

                <Cell muted className="tabular-nums">
                  {rate(c.totalOpened, c.totalDelivered || c.totalSent)}
                </Cell>

                <Cell muted className="tabular-nums">
                  {rate(c.totalClicked, c.totalDelivered || c.totalSent)}
                </Cell>

                <Cell muted className="whitespace-nowrap text-xs">
                  {when(c.sentAt, c.scheduledFor, c.createdAt)}
                </Cell>
              </Row>
            ))}
          </AdminTable>
        )}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  text,
  accent,
}: {
  label: string;
  value?: number;
  text?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <dt className="text-xs uppercase tracking-widest text-neutral-600">{label}</dt>
      <dd
        className={`mt-2 font-display text-2xl ${
          accent ? "text-brand-onLight" : "text-ink"
        }`}
      >
        {text ?? (value ?? 0).toLocaleString("en-US")}
      </dd>
    </div>
  );
}

/** Never divide by zero, and never print a rate for a campaign that never sent. */
function rate(part: number, whole: number) {
  if (!whole) return <span className="text-neutral-400">—</span>;
  return (
    <>
      {part.toLocaleString("en-US")}
      <span className="block text-[11px] text-neutral-400">
        {Math.round((part / whole) * 100)}%
      </span>
    </>
  );
}

function when(sentAt: Date | null, scheduledFor: Date | null, createdAt: Date) {
  const fmt = (d: Date) =>
    d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (sentAt) return <>Sent {fmt(sentAt)}</>;
  if (scheduledFor) return <span className="text-brand">For {fmt(scheduledFor)}</span>;
  return <>Drafted {fmt(createdAt)}</>;
}
