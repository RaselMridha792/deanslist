import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { CrudForm, StatusPill } from "@/components/admin/crud";
import { setConversationReviewed } from "@/app/admin/chatbot-actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * One transcript, in order, exactly as the visitor saw it.
 *
 * Nothing here is editable except the review state. The thread is the record of
 * what a public assistant told someone about a prize competition; a screen that
 * let a reviewer rewrite it after the fact would make that record worthless.
 *
 * Note the two separate facts in the header. `resolved` says the VISITOR
 * reached the end of the guided flow and is written by the public chat route;
 * `reviewedAt` says somebody here has read the thread and is written only by
 * the button in the sidebar. A finished chat is still an unread chat.
 */
export default async function ChatbotTranscriptPage({ params }: Props) {
  await requireRole("EDITOR");
  const { id } = await params;

  const convo = await prisma.conversation.findUnique({
    where: { id },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          type: true,
          status: true,
          source: true,
        },
      },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!convo) notFound();

  const started = formatDateTime(convo.createdAt);
  const reviewedOn = convo.reviewedAt ? formatDateTime(convo.reviewedAt) : null;

  return (
    <>
      <Link href="/admin/chatbot" className="btn-quiet">
        Back to transcripts
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide">
            {convo.intent ? titleCase(convo.intent) : "Conversation"}
          </h1>
          <p className="mt-2 text-sm text-chalk-muted">
            {started} · {convo.messages.length}{" "}
            {convo.messages.length === 1 ? "message" : "messages"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            value={convo.resolved ? "Visitor finished" : "Visitor left part-way"}
            tone={convo.resolved ? "good" : "mute"}
          />
          {convo.handedOff && <StatusPill value="Handed off" tone="warn" />}
          <StatusPill
            value={convo.leadId ? "Contact captured" : "No contact"}
            tone={convo.leadId ? "good" : "mute"}
          />
          <StatusPill
            value={reviewedOn ? "Read by us" : "Needs review"}
            tone={reviewedOn ? "good" : "warn"}
          />
        </div>
      </div>

      <div className="mt-10 grid gap-10 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <p className="label">Transcript</p>
          {convo.messages.length === 0 ? (
            <div className="rounded-card border border-dashed border-ink-edge bg-ink-soft p-8 text-center text-sm text-chalk-muted">
              This conversation was opened but nothing was ever said.
            </div>
          ) : (
            <ol className="space-y-3">
              {convo.messages.map((m) => {
                const role = m.role.toLowerCase();
                const isAssistant = role === "assistant";
                const isSystem = role === "system";
                return (
                  <li
                    key={m.id}
                    className={[
                      "rounded-card border p-4",
                      isAssistant && "border-brand/25 bg-ink-raised",
                      isSystem && "border-dashed border-ink-line bg-transparent",
                      !isAssistant && !isSystem && "border-ink-line bg-ink-soft",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <span
                        className={[
                          "text-[10px] font-semibold uppercase tracking-widest",
                          isAssistant ? "text-brand" : "text-chalk-faint",
                        ].join(" ")}
                      >
                        {isAssistant ? "Assistant" : isSystem ? "System" : "Visitor"}
                      </span>
                      <time
                        dateTime={m.createdAt.toISOString()}
                        className="text-[10px] text-chalk-ghost"
                      >
                        {m.createdAt.toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <p
                      className={[
                        "mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed",
                        isSystem ? "text-chalk-faint" : "text-chalk-body",
                      ].join(" ")}
                    >
                      {m.content}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-card border border-ink-line bg-ink-soft p-6">
            <p className="label">Captured contact</p>
            {convo.lead ? (
              <>
                <Link
                  href={`/admin/leads/${convo.lead.id}`}
                  className="font-display text-xl tracking-wide text-chalk transition-colors hover:text-brand"
                >
                  {[convo.lead.firstName, convo.lead.lastName].filter(Boolean).join(" ") ||
                    convo.lead.email}
                </Link>
                <dl className="mt-4 space-y-2 text-sm">
                  <Line label="Email" value={convo.lead.email} href={`mailto:${convo.lead.email}`} />
                  <Line
                    label="Phone"
                    value={convo.lead.phone}
                    href={convo.lead.phone ? `tel:${convo.lead.phone}` : undefined}
                  />
                  <Line label="Type" value={titleCase(convo.lead.type)} />
                  <Line label="Status" value={titleCase(convo.lead.status)} />
                  <Line label="Source" value={titleCase(convo.lead.source)} />
                </dl>
                <Link
                  href={`/admin/leads/${convo.lead.id}`}
                  className="btn-quiet mt-5 !text-xs"
                >
                  Open the full lead</Link>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-chalk-muted">
                No contact details were captured. The widget creates a lead the moment it has an
                email address, so a chat with nothing attached means the visitor left before
                giving one.
              </p>
            )}
          </div>

          <div className="rounded-card border border-ink-line bg-ink-soft p-6">
            <p className="label">Review</p>
            <p className="mb-4 text-xs leading-relaxed text-chalk-faint">
              {reviewedOn
                ? `Read on ${reviewedOn}${
                    convo.reviewedBy ? ` by ${convo.reviewedBy}` : ""
                  }. Put it back in the queue if it still needs a reply.`
                : convo.resolved
                  ? "The visitor reached the end of the flow, which is not the same as anyone here having read it. Mark it read once someone has been through the thread and sent any follow-up."
                  : "The visitor left part-way through. Mark this read once it has been through and any follow-up has been sent."}
            </p>
            {/* CrudForm is the one save behaviour every admin screen uses: disabled
                while pending, error inline, refresh only on success. */}
            <CrudForm
              action={setConversationReviewed}
              submitLabel={reviewedOn ? "Put back in the queue" : "Mark as read"}
            >
              <input type="hidden" name="id" value={convo.id} />
              <input type="hidden" name="reviewed" value={reviewedOn ? "false" : "true"} />
            </CrudForm>
          </div>

          <details className="rounded-card border border-ink-line bg-ink-soft p-6">
            <summary className="cursor-pointer text-xs uppercase tracking-widest text-chalk-faint">
              Technical detail
            </summary>
            <dl className="mt-4 space-y-2 text-xs">
              <Line label="Session" value={convo.sessionId} />
              <Line label="IP address" value={convo.ipAddress} />
              <Line label="Intent" value={convo.intent} />
              <Line label="Last activity" value={formatDateTime(convo.updatedAt)} />
              <Line label="Reviewed by" value={convo.reviewedBy} />
            </dl>
          </details>
        </aside>
      </div>
    </>
  );
}

function Line({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-[10px] uppercase tracking-widest text-chalk-faint">{label}</dt>
      <dd className="break-all text-right text-chalk-body">
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

function formatDateTime(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ");
}
