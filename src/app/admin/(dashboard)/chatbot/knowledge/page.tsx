import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  AdminPageHeader,
  Checkbox,
  CrudForm,
  DeleteButton,
  EmptyState,
  Field,
  TextArea,
} from "@/components/admin/crud";
import {
  deleteKnowledgeItem,
  saveKnowledgeItem,
  scanForSpecifics,
  toggleKnowledgeActive,
} from "@/app/admin/chatbot-actions";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The knowledge base.
 *
 * This is the entire universe the assistant may answer from: no model knowledge,
 * no improvisation, no "it probably closes in August". That makes this screen a
 * publishing surface pointed at contestants in a public prize competition, so it
 * says so at the top, badges any row that states a specific, and refuses to save
 * an unconfirmed one (the gate lives in saveKnowledgeItem, server-side, because a
 * warning nobody has to answer is decoration).
 *
 * Which row is being edited lives in the URL rather than in component state. That
 * keeps the whole screen a Server Component, guarantees only one form is mounted
 * at a time, and means a saved form navigates away from itself instead of sitting
 * there still holding the text that was just submitted.
 */
export default async function KnowledgeBasePage({ searchParams }: Props) {
  await requireRole("EDITOR");

  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : undefined;
  };

  const q = one("q");
  const category = one("category");
  const editId = one("edit");
  const creating = one("new") === "1";

  const where: Prisma.KnowledgeItemWhereInput = {};
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { question: { contains: q, mode: "insensitive" } },
      { answer: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, categories, activeCount, offlineCount, handoffs] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where,
      orderBy: [{ category: { sort: "asc", nulls: "last" } }, { question: "asc" }],
      take: 500,
    }),
    prisma.knowledgeItem.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
      take: 50,
    }),
    prisma.knowledgeItem.count({ where: { active: true } }),
    prisma.knowledgeItem.count({ where: { active: false } }),
    prisma.conversation.count({
      where: { handedOff: true, createdAt: { gte: new Date(Date.now() - 30 * DAY) } },
    }),
  ]);

  // One call for the whole list: the same detector the save path enforces, so a
  // badge here and a blocked save there can never disagree.
  const flags = await scanForSpecifics(items.map((i) => `${i.question}\n${i.answer}`));
  const flaggedCount = flags.filter((f) => f.length > 0).length;

  const filtered = Boolean(q || category);
  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (category) listParams.set("category", category);
  const listQuery = listParams.toString();
  const baseHref = `/admin/chatbot/knowledge${listQuery ? `?${listQuery}` : ""}`;
  const hrefWith = (key: "new" | "edit", value: string) => {
    const params = new URLSearchParams(listQuery);
    params.set(key, value);
    return `/admin/chatbot/knowledge?${params.toString()}`;
  };

  const categoryHelp =
    categories.length > 0
      ? `Groups answers in this list. Already in use: ${categories
          .map((c) => c.category)
          .filter(Boolean)
          .join(", ")}.`
      : "Groups answers in this list. Anything short works: entry, shows, prizes, contact.";

  return (
    <>
      <AdminPageHeader
        title="Knowledge base"
        description="The answers the assistant is allowed to give. It has no other source."
        action={
          <Link href="/admin/chatbot" className="btn btn-ghost !px-5 !py-2.5 !text-xs">
            Transcripts
          </Link>
        }
      />

      {/* Brand, not red. Red is reserved for live urgency; this is a standing rule
          that has to be read once and remembered, not an alarm. */}
      <div className="mt-8 border border-brand/40 bg-brand/5 p-6">
        <p className="eyebrow">Read this before you edit</p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink">
          Whatever you write here is what a visitor is told, word for word. The assistant answers
          from these rows and nothing else, so a wrong prize amount or a wrong deadline in this
          list becomes a wrong answer given to a contestant about a public prize competition —
          and that is a promise the client has to keep.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink">
          Only publish a date, an amount, a deadline, or a rule about who may enter if you can
          point at a client-confirmed source for it. If it is not confirmed, say the bot does not
          have it and send them to the team. An honest &ldquo;I do not have that yet&rdquo; costs
          nothing; an invented deadline costs an entry.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Answers live" value={activeCount} />
        <Stat label="Taken offline" value={offlineCount} note="never shown to visitors" />
        <Stat
          label="State a specific"
          value={flaggedCount}
          note={filtered ? "in this filtered list" : "date, amount, deadline or entry rule"}
        />
        <Link href="/admin/chatbot?state=handedoff" className="card-interactive block p-5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-600">
            Handed off (30 days)
          </p>
          <p className="mt-2 font-display text-3xl text-ink">{handoffs.toLocaleString("en-US")}</p>
          <p className="mt-1 text-xs text-neutral-600">questions this list could not answer</p>
        </Link>
      </div>

      <p className="help mt-4 max-w-3xl">
        Which individual answers the assistant actually used is not recorded — nothing writes a
        usage count, and inventing one from message text would be a guess. The handoff figure
        above is the real signal available: it counts the conversations that ended with the bot
        admitting it had no answer, which is where the next entry in this list should come from.
      </p>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        {/* Plain GET form: no client JavaScript, and the filtered view is a URL. */}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="f-q">
              Search
            </label>
            <input
              id="f-q"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Question or answer text"
              className="field w-[16rem]"
            />
          </div>
          <div>
            <label className="label" htmlFor="f-category">
              Category
            </label>
            <select
              id="f-category"
              name="category"
              defaultValue={category ?? ""}
              className="field w-[11rem]"
            >
              <option value="">Any</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category ?? ""}>
                  {c.category}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-ghost !px-5 !py-2.5 !text-xs">
            Filter
          </button>
          {filtered && (
            <Link
              href="/admin/chatbot/knowledge"
              className="pb-3 text-xs uppercase tracking-widest text-neutral-600 transition-colors hover:text-brand"
            >
              Clear
            </Link>
          )}
        </form>

        {!creating && (
          <Link href={hrefWith("new", "1")} className="btn btn-primary !px-5 !py-2.5 !text-xs">
            Add an answer
          </Link>
        )}
      </div>

      {creating && (
        <div className="mt-6 border border-brand/30 bg-white p-6">
          <p className="label">New answer</p>
          <CrudForm action={saveKnowledgeItem} submitLabel="Publish answer" redirectTo={baseHref}>
            <KnowledgeFields categoryHelp={categoryHelp} />
          </CrudForm>
          <Link href={baseHref} className="btn-quiet mt-5 !text-xs">
            Cancel
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <EmptyState
            title={filtered ? "Nothing matches" : "The bot knows nothing yet"}
            body={
              filtered
                ? "No answer matches this search. Clear it to see the whole list."
                : "With an empty knowledge base the assistant can only say it does not know and hand the visitor to the team. Add the questions you already answer by email every week."
            }
            action={
              filtered ? (
                <Link href="/admin/chatbot/knowledge" className="btn btn-ghost !px-5 !py-2.5 !text-xs">
                  Clear filters
                </Link>
              ) : (
                <Link href={hrefWith("new", "1")} className="btn btn-primary !px-5 !py-2.5 !text-xs">
                  Add the first answer
                </Link>
              )
            }
          />
        ) : (
          items.map((item, i) => {
            const itemFlags = flags[i] ?? [];
            const editing = editId === item.id;

            return (
              <article
                key={item.id}
                className={` border bg-white p-6 ${
                  editing ? "border-brand/30" : "border-rule"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg tracking-wide text-ink">
                      {item.question}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {item.category && <span className="badge">{item.category}</span>}
                      <span
                        className={
                          item.active
                            ? "badge border-emerald-700 bg-emerald-50 text-emerald-800"
                            : "badge"
                        }
                      >
                        {item.active ? "Live" : "Offline"}
                      </span>
                      {itemFlags.map((f) => (
                        <span key={f} className="badge border-brand bg-brand text-white">
                          States {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    {!editing && (
                      <Link href={hrefWith("edit", item.id)} className="btn-quiet !text-xs">
                        Edit
                      </Link>
                    )}
                    {/* A wrong answer has to be pullable in one click, without
                        first passing back through the edit form. Plain form, no
                        client JavaScript required. */}
                    <form action={toggleKnowledgeActive}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="active" value={item.active ? "false" : "true"} />
                      <button type="submit" className="btn-quiet !text-xs">
                        {item.active ? "Take offline" : "Publish"}
                      </button>
                    </form>
                  </div>
                </div>

                {editing ? (
                  <div className="mt-6 border-t border-rule pt-6">
                    <CrudForm
                      action={saveKnowledgeItem}
                      submitLabel="Save answer"
                      redirectTo={baseHref}
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <KnowledgeFields
                        categoryHelp={categoryHelp}
                        question={item.question}
                        answer={item.answer}
                        category={item.category}
                        active={item.active}
                      />
                    </CrudForm>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-5">
                      <Link href={baseHref} className="btn-quiet !text-xs">
                        Cancel
                      </Link>
                      <DeleteButton
                        action={deleteKnowledgeItem.bind(null, item.id)}
                        name={item.question}
                        label="Delete this answer"
                        redirectTo={baseHref}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {item.answer}
                    </p>
                    <p className="mt-4 text-[10px] uppercase tracking-widest text-neutral-400">
                      Updated{" "}
                      {item.updatedAt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </>
                )}
              </article>
            );
          })
        )}
      </div>
    </>
  );
}

/**
 * One set of fields for both create and edit, so the two forms cannot drift on
 * wording, help text, or the confirmation box the save path checks for.
 */
function KnowledgeFields({
  categoryHelp,
  question,
  answer,
  category,
  active = true,
}: {
  categoryHelp: string;
  question?: string;
  answer?: string;
  category?: string | null;
  active?: boolean;
}) {
  return (
    <>
      <Field
        label="Question"
        name="question"
        defaultValue={question}
        required
        span
        placeholder="How do I enter?"
        help="Write it the way a visitor would ask it, not the way the team words it internally."
      />
      <TextArea
        label="Answer"
        name="answer"
        defaultValue={answer}
        required
        rows={6}
        placeholder="Use the entry form on the site. You need your contact details, your talent category, and a public link to a performance video."
        help="This exact text is what a visitor is told. Keep it short, keep it true, and leave out anything the client has not confirmed."
      />
      <Field
        label="Category"
        name="category"
        defaultValue={category ?? ""}
        placeholder="entry"
        help={categoryHelp}
      />
      <Checkbox
        label="Live — the assistant may use this answer"
        name="active"
        defaultChecked={active}
        help="Untick to keep the wording without letting the bot say it."
      />
      <Checkbox
        label="I have checked every date, amount, deadline and entry rule in this answer against a confirmed source"
        name="confirmed"
        help="Required only when the answer states one. The save is refused otherwise — this is the last stop before a contestant is told a number as fact."
      />
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] uppercase tracking-widest text-neutral-600">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value.toLocaleString("en-US")}</p>
      {note && <p className="mt-1 text-xs text-neutral-600">{note}</p>}
    </div>
  );
}
