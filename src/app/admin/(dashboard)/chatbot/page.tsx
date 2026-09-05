import Link from "next/link";
import type { Prisma } from "@prisma/client";
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

const PAGE_SIZE = 50;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Chatbot transcripts.
 *
 * The console exists so somebody can answer two questions without opening a
 * database client: what are visitors actually asking, and did we capture them.
 * The second is the whole point of the rebuild — the old site leaked every lead
 * to a third-party iframe — so "captured lead" is a first-class column and a
 * filter, not a detail buried in the transcript.
 *
 * Two facts about a conversation look alike and are not, so they get separate
 * columns and separate filters:
 *
 *   resolved   — the VISITOR finished the guided capture flow. Written by the
 *                public chat route (src/app/api/chat/route.ts), with nobody on
 *                this side of the screen involved.
 *   reviewedAt — somebody in this console has actually read the thread.
 *
 * Reading the first as the second is how a review queue ends up permanently
 * empty while hundreds of transcripts sit unread.
 *
 * The screen opens on the queue — unread, newest first — rather than on
 * everything, because a list that opens on hundreds of rows nobody has to act
 * on is a list nobody reads. Filters are plain GET form fields, so this stays a
 * Server Component and every view is a shareable URL.
 */
export default async function ChatbotTranscriptsPage({ searchParams }: Props) {
  await requireRole("EDITOR");

  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : undefined;
  };

  // Intents are written by the widget, not chosen from an enum, so they are
  // sanity-checked by shape rather than against a list that would go stale.
  const rawIntent = one("intent");
  const intent = rawIntent && /^[a-z][a-z0-9 _-]{0,39}$/i.test(rawIntent) ? rawIntent : undefined;

  const rawLead = one("lead");
  const lead = rawLead === "yes" || rawLead === "no" ? rawLead : undefined;

  // The knowledge screen still links here with the single pre-split `state`
  // param, so it is honoured as an alias rather than quietly dropping that
  // reader on a different list. An explicit review / outcome always wins.
  const legacy = one("state");

  // Absent means the queue, not "everything". The default view has to be the
  // work; the whole history is one click away on review=any.
  const rawReview = one("review");
  const review: "pending" | "reviewed" | "any" =
    rawReview === "reviewed" || rawReview === "any"
      ? rawReview
      : !rawReview && (legacy === "resolved" || legacy === "handedoff")
        ? "any"
        : "pending";

  // How the chat ended for the visitor — a different axis from whether anyone
  // here has read it.
  const rawOutcome =
    one("outcome") ??
    (legacy === "handedoff" ? "handedoff" : legacy === "resolved" ? "finished" : undefined);
  const outcome =
    rawOutcome === "finished" || rawOutcome === "partial" || rawOutcome === "handedoff"
      ? rawOutcome
      : undefined;

  const pageNum = Math.max(1, Math.floor(Number(one("page") ?? 1)) || 1);

  const where: Prisma.ConversationWhereInput = {};
  if (intent) where.intent = intent;
  if (lead === "yes") where.leadId = { not: null };
  if (lead === "no") where.leadId = null;
  if (review === "pending") where.reviewedAt = null;
  if (review === "reviewed") where.reviewedAt = { not: null };
  if (outcome === "finished") where.resolved = true;
  if (outcome === "partial") where.resolved = false;
  if (outcome === "handedoff") where.handedOff = true;

  const [rows, total, intents, allCount, withLead, handedOff, finished, unread] = await Promise.all(
    [
      prisma.conversation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.conversation.count({ where }),
      prisma.conversation.findMany({
        where: { intent: { not: null } },
        select: { intent: true },
        distinct: ["intent"],
        orderBy: { intent: "asc" },
        take: 40,
      }),
      prisma.conversation.count(),
      prisma.conversation.count({ where: { leadId: { not: null } } }),
      prisma.conversation.count({ where: { handedOff: true } }),
      prisma.conversation.count({ where: { resolved: true } }),
      prisma.conversation.count({ where: { reviewedAt: null } }),
    ],
  );

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // review=pending is where the screen starts, so it is not a filter the reader
  // chose and needs a way back out of.
  const filtered = Boolean(intent || lead || outcome) || review !== "pending";

  const query = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = {
      intent,
      lead,
      review,
      outcome,
      page: pageNum,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === "") continue;
      if (k === "page" && Number(v) === 1) continue;
      if (k === "review" && v === "pending") continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <AdminPageHeader
        title="Chatbot"
        description="Every conversation the widget has had, the contacts it captured, and the answers it is allowed to give. A chat the visitor finished still has to be read by someone here, so this list opens on the unread ones."
        action={
          <Link href="/admin/chatbot/knowledge" className="btn btn-ghost !px-5 !py-2.5 !text-xs">
            Knowledge base
          </Link>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Waiting to be read"
          value={unread}
          href="/admin/chatbot"
          note="nobody here has opened these"
        />
        <Stat label="Conversations" value={allCount} href="/admin/chatbot?review=any" />
        <Stat
          label="Captured a contact"
          value={withLead}
          href="/admin/chatbot?review=any&lead=yes"
          note={
            allCount > 0 ? `${Math.round((withLead / allCount) * 100)}% of all chats` : undefined
          }
        />
        <Stat
          label="Visitor finished"
          value={finished}
          href="/admin/chatbot?review=any&outcome=finished"
          note="reached the end of the flow"
        />
        <Stat
          label="Handed off"
          value={handedOff}
          href="/admin/chatbot?review=any&outcome=handedoff"
          note="the bot had no answer"
        />
      </div>

      {/* No JavaScript: a GET form puts the filter in the URL, which is what makes
          a view shareable and what the pagination links rebuild from. */}
      <form method="get" className="mt-6 border border-admin-line-strong bg-admin-panel p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="f-review">
              Read by us
            </label>
            <select id="f-review" name="review" defaultValue={review} className="field w-[11rem]">
              <option value="pending">Not read yet</option>
              <option value="reviewed">Already read</option>
              <option value="any">Any</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-outcome">
              How it ended
            </label>
            <select
              id="f-outcome"
              name="outcome"
              defaultValue={outcome ?? ""}
              className="field w-[11rem]"
            >
              <option value="">Any</option>
              <option value="finished">Visitor finished</option>
              <option value="partial">Left part-way</option>
              <option value="handedoff">Handed off</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-intent">
              Intent
            </label>
            <select
              id="f-intent"
              name="intent"
              defaultValue={intent ?? ""}
              className="field w-[11rem]"
            >
              <option value="">Any</option>
              {intents.map((i) => (
                <option key={i.intent} value={i.intent ?? ""}>
                  {titleCase(i.intent ?? "")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-lead">
              Contact captured
            </label>
            <select id="f-lead" name="lead" defaultValue={lead ?? ""} className="field w-[11rem]">
              <option value="">Any</option>
              <option value="yes">Captured a lead</option>
              <option value="no">No contact details</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary !px-5 !py-2.5 !text-xs">
            Apply
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-admin-line pt-4 text-xs">
          <span className="text-admin-muted">{total.toLocaleString("en-US")} matching</span>
          {filtered && (
            <Link
              href="/admin/chatbot"
              className="uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
            >
              Back to the unread queue
            </Link>
          )}
        </div>
      </form>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title={
              filtered
                ? "Nothing matches"
                : allCount > 0
                  ? "Nothing left to read"
                  : "No conversations yet"
            }
            body={
              filtered
                ? "No conversation matches this filter. Clear it to go back to the unread queue."
                : allCount > 0
                  ? "Every transcript the widget has recorded has been opened and marked as read. Set the first filter to Any to look back over the history."
                  : "The widget writes a row here the moment a visitor opens the chat, and attaches the lead as soon as it captures an email address. Nothing has been recorded yet."
            }
            action={
              filtered ? (
                <Link href="/admin/chatbot" className="btn btn-ghost !px-5 !py-2.5 !text-xs">
                  Back to the unread queue
                </Link>
              ) : allCount > 0 ? (
                <Link href="/admin/chatbot?review=any" className="btn btn-ghost !px-5 !py-2.5 !text-xs">
                  Show every conversation
                </Link>
              ) : (
                <Link href="/admin/chatbot/knowledge" className="btn btn-ghost !px-5 !py-2.5 !text-xs">
                  Review what the bot can answer
                </Link>
              )
            }
          />
        ) : (
          <AdminTable
            head={["Started", "Intent", "Messages", "Captured contact", "How it ended", "Read by us"]}
          >
            {rows.map((c) => (
              <Row key={c.id}>
                <Cell>
                  <RowLink href={`/admin/chatbot/${c.id}`}>{formatDateTime(c.createdAt)}</RowLink>
                </Cell>
                <Cell muted>{c.intent ? titleCase(c.intent) : "—"}</Cell>
                <Cell muted>{c._count.messages}</Cell>
                <Cell>
                  {c.lead ? (
                    <Link
                      href={`/admin/leads/${c.lead.id}`}
                      className="text-brand-onDark transition-colors hover:underline"
                    >
                      {[c.lead.firstName, c.lead.lastName].filter(Boolean).join(" ") ||
                        c.lead.email}
                    </Link>
                  ) : (
                    <span className="text-admin-faint">—</span>
                  )}
                </Cell>

                {/* What the visitor did. Nothing in this console writes it. */}
                <Cell>
                  <span className="flex flex-wrap gap-2">
                    <StatusPill
                      value={c.resolved ? "Finished" : "Left part-way"}
                      tone={c.resolved ? "good" : "mute"}
                    />
                    {c.handedOff && <StatusPill value="Handed off" tone="warn" />}
                  </span>
                </Cell>

                {/* What we did. Only the console writes this. */}
                <Cell>
                  {c.reviewedAt ? (
                    <span className="flex flex-col items-start gap-1">
                      <StatusPill value="Read" tone="good" />
                      <span className="break-all text-[10px] leading-tight text-admin-faint">
                        {formatDate(c.reviewedAt)}
                        {c.reviewedBy ? ` · ${c.reviewedBy}` : ""}
                      </span>
                    </span>
                  ) : (
                    <StatusPill value="Needs review" tone="warn" />
                  )}
                </Cell>
              </Row>
            ))}
          </AdminTable>
        )}
      </div>

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
          <p className="text-admin-faint">
            Page {pageNum} of {pages}
          </p>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                href={`/admin/chatbot${query({ page: pageNum - 1 })}`}
                className="btn btn-ghost !px-4 !py-2 !text-xs"
              >
                Previous
              </Link>
            )}
            {pageNum < pages && (
              <Link
                href={`/admin/chatbot${query({ page: pageNum + 1 })}`}
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

function Stat({
  label,
  value,
  href,
  note,
}: {
  label: string;
  value: number;
  href: string;
  note?: string;
}) {
  return (
    <Link href={href} className="card-interactive block p-5">
      <p className="text-[10px] uppercase tracking-widest text-admin-faint">{label}</p>
      <p className="mt-2 font-display text-3xl text-admin-text">{value.toLocaleString("en-US")}</p>
      {note && <p className="mt-1 text-xs text-admin-faint">{note}</p>}
    </Link>
  );
}

function formatDateTime(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ");
}
