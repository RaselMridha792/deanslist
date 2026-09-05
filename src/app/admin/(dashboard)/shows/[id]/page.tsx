import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { extractYouTubeId } from "@/lib/queries";
import {
  AdminPageHeader,
  AdminTable,
  Cell,
  CrudForm,
  DeleteButton,
  EmptyState,
  Field,
  Row,
  Select,
  StatusPill,
  TextArea,
  toLocalInput,
} from "@/components/admin/crud";
import {
  deleteEpisode,
  deleteShow,
  saveEpisode,
  updateShow,
} from "@/app/admin/shows-actions";

export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/New_York";

const TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Karachi",
  "Asia/Manila",
  "Australia/Sydney",
] as const;

const STATUSES = [
  { value: "DRAFT", label: "Draft — invisible to the public" },
  { value: "OPEN", label: "Open — taking entries, featured on the homepage" },
  { value: "LIVE", label: "Live — on air now, takes over the homepage hero" },
  { value: "CLOSED", label: "Closed — season over, page stays up" },
  { value: "ARCHIVED", label: "Archived — kept for the record" },
] as const;

const STATUS_TONE: Record<string, "good" | "warn" | "mute"> = {
  LIVE: "warn",
  OPEN: "good",
  DRAFT: "mute",
  CLOSED: "mute",
  ARCHIVED: "mute",
};

/* ---------------------------------------------------------------- timezone */

function isValidZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset of `timeZone` from UTC, in milliseconds, at one specific instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}

/**
 * The stored instant, as the "YYYY-MM-DDTHH:mm" a datetime-local input wants,
 * written in `timeZone` rather than in whatever zone this process happens to run
 * in — UTC on the VPS, the developer's zone locally.
 *
 * toLocalInput() from the CRUD kit does the formatting, because that is the one
 * place the input's exact format is decided. It reads a Date with local getters,
 * so the instant is first shifted until its process-local wall clock IS the wall
 * clock in `timeZone`. Two passes, in case the shift crosses the process zone's
 * own daylight-saving boundary.
 */
function toZonedInput(d: Date | null, timeZone: string): string {
  if (!d) return "";
  const target = d.getTime() + zoneOffsetMs(d, timeZone);
  let shifted = new Date(target + new Date(target).getTimezoneOffset() * 60_000);
  shifted = new Date(target + shifted.getTimezoneOffset() * 60_000);
  return toLocalInput(shifted);
}

/** "EDT · GMT-04:00" — what the admin needs to trust the number they typed. */
function zoneLabel(timeZone: string, at: Date): string {
  const part = (style: "short" | "longOffset") =>
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: style })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "";

  const abbr = part("short");
  const offset = part("longOffset");
  return abbr && abbr !== offset ? `${abbr} · ${offset}` : offset;
}

/** "America/New_York" -> "New York". "UTC" stays "UTC". */
function shortZone(timeZone: string): string {
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

function one(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ?? "";
}

/* -------------------------------------------------------------------- page */

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShowEditPage({ params, searchParams }: Props) {
  const session = await requireRole("EDITOR");
  const { id } = await params;
  const sp = await searchParams;

  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      episodes: {
        orderBy: [
          { episodeNo: { sort: "desc", nulls: "last" } },
          { airedAt: { sort: "desc", nulls: "last" } },
        ],
      },
      _count: { select: { leads: true, winners: true, gallery: true, campaigns: true } },
    },
  });
  if (!show) notFound();

  // Zone is a URL parameter, not a guess: the fields below are rendered in it and
  // the form posts it back, so the wall clock the admin reads is always the wall
  // clock the server writes. Switching zones re-renders every value.
  const tzParam = one(sp.tz);
  const activeTz = tzParam && isValidZone(tzParam) ? tzParam : DEFAULT_TZ;
  const now = new Date();

  const editId = one(sp.edit);
  const editing = editId ? (show.episodes.find((e) => e.id === editId) ?? null) : null;

  const featured = await prisma.show.findMany({
    where: { status: { in: ["LIVE", "OPEN"] } },
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
  });
  const otherLive = featured.filter((s) => s.status === "LIVE" && s.id !== show.id);
  const otherOpen = featured.filter((s) => s.status === "OPEN" && s.id !== show.id);
  const anyLive = featured.some((s) => s.status === "LIVE");

  /**
   * What this show currently does to the homepage. getCurrentShow() takes the
   * first LIVE row, or the first OPEN one when nothing is live — so "featured"
   * is only a claim worth printing when this show is the sole candidate.
   */
  const heroNote: { urgent: boolean; body: React.ReactNode } | null =
    show.status === "LIVE" && otherLive.length > 0
      ? {
          urgent: true,
          body: (
            <>
              <span className="font-semibold text-brand-onDark">
                Another show is LIVE at the same time.
              </span>{" "}
              The homepage hero features exactly one, and which of the two it picks is not
              something the team controls. Close or reopen the other:{" "}
              <ShowLinks shows={otherLive} />.
            </>
          ),
        }
      : show.status === "LIVE" || (show.status === "OPEN" && !anyLive && otherOpen.length === 0)
        ? {
            urgent: false,
            body: (
              <>
                <span className="font-semibold text-brand-onDark">This is the homepage show.</span> The
                hero, the countdown and the &ldquo;Enter the contest&rdquo; button all point
                here.
              </>
            ),
          }
        : show.status === "OPEN" && anyLive
          ? {
              urgent: false,
              body: (
                <>
                  <span className="font-semibold text-brand-onDark">
                    A live show outranks this one.
                  </span>{" "}
                  This show is open for entries, but the homepage hero features the LIVE show
                  until it closes.
                </>
              ),
            }
          : show.status === "OPEN"
            ? {
                urgent: true,
                body: (
                  <>
                    <span className="font-semibold text-brand-onDark">
                      More than one show is OPEN and none is LIVE.
                    </span>{" "}
                    The homepage features one of them and it may not be this one. Mark the
                    current show LIVE, or close: <ShowLinks shows={otherOpen} />.
                  </>
                ),
              }
            : null;

  /**
   * Form keys. Every input below is uncontrolled — CrudForm renders plain
   * `defaultValue`, so once the admin has touched a field React will not push a
   * new default into it. The zone chips are <Link>s, so switching zones is a
   * soft navigation: the server re-renders the datetime defaults in the new
   * zone, but the DOM keeps the old wall clock while the hidden `timeZone`
   * field (a controlled `value`) flips to the new zone. The action then reads
   * that old clock as if it were the new zone and stores an instant hours off —
   * the exact failure this whole zone round-trip exists to prevent, and the
   * homepage countdown is computed from that instant.
   *
   * Keying on the active zone remounts the form instead, so the clock on screen
   * and the zone posted with it can never disagree. The show key carries the
   * show id for the same reason: two show pages differ only by a route param.
   */
  const showFormKey = `show-${show.id}-${activeTz}`;
  const episodeFormKey = `${editing?.id ?? `new-${show.episodes.length}`}-${activeTz}`;

  const href = (next: { tz?: string; edit?: string | null; hash?: string }) => {
    const q = new URLSearchParams();
    const tz = next.tz ?? activeTz;
    if (tz !== DEFAULT_TZ) q.set("tz", tz);
    const edit = next.edit === undefined ? editId : next.edit;
    if (edit) q.set("edit", edit);
    const query = q.toString();
    return `/admin/shows/${show.id}${query ? `?${query}` : ""}${next.hash ?? ""}`;
  };

  return (
    <>
      <Link href="/admin/shows" className="btn-quiet">
        Back to shows
      </Link>

      <div className="mt-6">
        <AdminPageHeader
          title={show.title}
          description={`/shows/${show.slug}`}
          action={
            <div className="flex items-center gap-4">
              <StatusPill value={show.status} tone={STATUS_TONE[show.status]} />
              {show.status === "DRAFT" ? (
                <span className="text-xs text-admin-faint">Not on the public site yet</span>
              ) : (
                <a
                  href={`/shows/${show.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-quiet"
                >
                  View public page ↗
                </a>
              )}
            </div>
          }
        />
      </div>

      {/* Both arms of this ternary were the same invisible tint, so `urgent`
          changed nothing on screen. A raised panel either way; the left rule is
          red when it is urgent and a plain line-strong edge when it is only a
          note, which is the distinction the flag was asking for. */}
      {heroNote && (
        <div
          className={`notice mt-8 ${
            heroNote.urgent ? "border-brand-onDark" : "border-admin-line-strong"
          }`}
        >
          <p className="text-sm text-admin-text">{heroNote.body}</p>
        </div>
      )}

      {/* ------------------------------------------------------------ zone */}

      <div className="mt-8 border border-admin-line-strong bg-admin-panel p-5">
        <p className="label">Timezone</p>
        <p className="text-sm text-admin-text">
          Every date on this page is written and read in{" "}
          <span className="font-semibold text-admin-text">{activeTz.replace(/_/g, " ")}</span>{" "}
          <span className="text-admin-faint">({zoneLabel(activeTz, now)})</span>. It is stored
          as a precise moment, so visitors in every country see it in their own zone.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TIME_ZONES.map((tz) =>
            tz === activeTz ? (
              <span
                key={tz}
                /* Current selection, not an alert, so it stays a chip: an
                   opaque raised plate the eye can find, closed by a full
                   brand-onDark edge. The old bg-brand/15 fill was 1.05:1 on
                   this panel and the /50 edge under 2:1 — the chosen zone was
                   marked by nothing but its own text colour. */
                className="border border-brand-onDark bg-admin-raised px-3 py-1 text-xs text-brand-onDark"
              >
                {shortZone(tz)}
              </span>
            ) : (
              <Link
                key={tz}
                href={href({ tz })}
                className="border border-admin-line px-3 py-1 text-xs text-admin-muted transition-colors hover:border-brand-onDark hover:text-brand-onDark"
                title={tz}
              >
                {shortZone(tz)}
              </Link>
            ),
          )}
        </div>
        <p className="help">
          Switching re-reads every time below in the new zone. The forms reset to what is
          stored, so save before you switch or unsaved edits are lost.
        </p>
      </div>

      {/* ------------------------------------------------------------ show */}

      <div className="mt-8 max-w-3xl">
        <CrudForm key={showFormKey} action={updateShow} submitLabel="Save show">
          <input type="hidden" name="id" value={show.id} />
          {/* The zone the fields below were rendered in, so the server reads the
              wall clock exactly as the admin was shown it. */}
          <input type="hidden" name="timeZone" value={activeTz} />

          <Field label="Title" name="title" required defaultValue={show.title} />

          <Field
            label="URL slug"
            name="slug"
            required
            defaultValue={show.slug}
            help="This is the public web address. Changing it breaks every link already shared."
          />

          <Field label="Tagline" name="tagline" defaultValue={show.tagline} span />

          <TextArea
            label="Description"
            name="description"
            rows={6}
            defaultValue={show.description}
          />

          <Select
            label="Status"
            name="status"
            required
            options={STATUSES}
            defaultValue={show.status}
            placeholder="Choose a status"
            help="Only one show should ever be LIVE."
          />

          <Field
            label="Prize amount"
            name="prizeAmount"
            type="number"
            defaultValue={show.prizeAmount}
            help="Whole number, no symbols. Blank until the client confirms it."
          />

          <Field label="Currency" name="currency" defaultValue={show.currency} />

          <div className="hidden sm:block" aria-hidden />

          <Field
            label={`Entry deadline (${shortZone(activeTz)})`}
            name="entryDeadline"
            type="datetime-local"
            defaultValue={toZonedInput(show.entryDeadline, activeTz)}
            help={
              show.entryDeadline
                ? `Stored as ${show.entryDeadline.toISOString()}`
                : "Blank on purpose while the date is unconfirmed — the homepage countdown hides itself rather than count to a date nobody agreed."
            }
          />

          <Field
            label={`Starts at (${shortZone(activeTz)})`}
            name="startsAt"
            type="datetime-local"
            defaultValue={toZonedInput(show.startsAt, activeTz)}
            help={show.startsAt ? `Stored as ${show.startsAt.toISOString()}` : "When it airs."}
          />

          <Field
            label="Hero image"
            name="heroImageUrl"
            defaultValue={show.heroImageUrl}
            span
            help="A path under /media, or a full https:// link."
          />

          <Field
            label="Trailer or hero video"
            name="trailerUrl"
            defaultValue={show.trailerUrl}
            span
            help="A path under /media (no file extension), or a full https:// link."
          />
        </CrudForm>
      </div>

      {/* -------------------------------------------------------- episodes */}

      <section id="episodes" className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl tracking-wide">Episodes</h2>
            <p className="mt-2 max-w-2xl text-sm text-admin-muted">
              These are the videos on /watch and in the homepage highlights. Paste the
              YouTube link — the thumbnail is taken from the video id, so there is nothing
              to upload and nothing to get wrong.
            </p>
          </div>
          <p className="text-xs text-admin-faint">
            {show.episodes.length} episode{show.episodes.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mt-6">
          {show.episodes.length === 0 ? (
            <EmptyState
              title="No episodes yet"
              body="Add the first one below. Until then this show contributes nothing to /watch or the homepage video grid."
            />
          ) : (
            <AdminTable
              head={["Thumb", "No.", "Title", `Aired (${shortZone(activeTz)})`, "Video id", "Actions"]}
            >
              {show.episodes.map((ep) => {
                const videoId = extractYouTubeId(ep.videoUrl);
                return (
                  <Row key={ep.id}>
                    <Cell className="w-24">
                      {ep.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ep.thumbnail}
                          alt=""
                          loading="lazy"
                          className="h-10 w-16 object-cover"
                        />
                      ) : (
                        <span className="block h-10 w-16 bg-admin-raised" />
                      )}
                    </Cell>
                    <Cell muted>{ep.episodeNo ?? "—"}</Cell>
                    <Cell>
                      <Link
                        href={href({ edit: ep.id, hash: "#episode-form" })}
                        className="font-medium text-admin-text transition-colors hover:text-brand-onDark"
                      >
                        {ep.title}
                      </Link>
                    </Cell>
                    <Cell muted>
                      {ep.airedAt
                        ? ep.airedAt.toLocaleString("en-GB", {
                            timeZone: activeTz,
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </Cell>
                    <Cell muted>
                      {videoId ? (
                        <a
                          href={`https://www.youtube.com/watch?v=${videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-onDark hover:underline"
                        >
                          {videoId}
                        </a>
                      ) : (
                        <span className="text-brand-onDark">No video id</span>
                      )}
                    </Cell>
                    <Cell>
                      <div className="flex items-center justify-end gap-4">
                        <Link
                          href={href({ edit: ep.id, hash: "#episode-form" })}
                          className="text-xs font-semibold uppercase tracking-widest text-admin-faint transition-colors hover:text-brand-onDark"
                        >
                          Edit
                        </Link>
                        {session.role === "OWNER" && (
                          <DeleteButton
                            action={deleteEpisode.bind(null, ep.id)}
                            name={ep.title}
                          />
                        )}
                      </div>
                    </Cell>
                  </Row>
                );
              })}
            </AdminTable>
          )}
        </div>

        {/* One episode form at a time — add, or edit the row picked in the URL.
            Rendering a form per row would put a dozen inputs with the same id on
            the page, which quietly breaks every label. */}
        <div id="episode-form" className="mt-8 max-w-3xl border border-admin-line-strong bg-admin-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg tracking-wide">
              {editing ? `Edit: ${editing.title}` : "Add an episode"}
            </h3>
            {editing && (
              <Link href={href({ edit: null, hash: "#episode-form" })} className="btn-quiet">
                Cancel — add a new one instead
              </Link>
            )}
          </div>

          {editId && !editing && (
            <p className="error-text mt-3">
              That episode no longer exists. Adding a new one instead.
            </p>
          )}

          <div className="mt-6">
            {/* The key changes the moment an episode is added, which remounts the
                form and clears it. Without that the fields keep what was just
                saved and a second click adds the same episode twice. It also
                carries the active zone, so switching zones re-reads "Aired at"
                instead of leaving the old clock under the new zone. */}
            <CrudForm
              key={episodeFormKey}
              action={saveEpisode}
              submitLabel={editing ? "Save episode" : "Add episode"}
            >
              <input type="hidden" name="id" value={editing?.id ?? ""} />
              <input type="hidden" name="showId" value={show.id} />
              <input type="hidden" name="timeZone" value={activeTz} />

              <Field
                label="Episode title"
                name="epTitle"
                required
                defaultValue={editing?.title}
                placeholder="Week 4 — Semi-final"
              />

              <Field
                label="Episode number"
                name="epNo"
                type="number"
                defaultValue={editing?.episodeNo}
                help="Optional. Used for ordering."
              />

              <Field
                label="YouTube link or video id"
                name="epVideoUrl"
                required
                span
                defaultValue={editing?.videoUrl}
                placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                help="A watch, live, shorts or youtu.be link, or the bare 11-character id. Facebook links are refused: the public player only plays YouTube, so they would save and then never appear."
              />

              <Field
                label={`Aired at (${shortZone(activeTz)})`}
                name="epAiredAt"
                type="datetime-local"
                defaultValue={toZonedInput(editing?.airedAt ?? null, activeTz)}
                help={
                  editing?.airedAt
                    ? `Stored as ${editing.airedAt.toISOString()}`
                    : "Newest first is how /watch orders them."
                }
              />

              <div className="hidden sm:block" aria-hidden />

              <TextArea
                label="Description"
                name="epDescription"
                rows={3}
                defaultValue={editing?.description}
              />
            </CrudForm>
          </div>

          <p className="help mt-5">
            The thumbnail is derived from the video id
            (i.ytimg.com/vi/&lt;id&gt;/hqdefault.jpg) and rewritten every time this saves.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- danger */}

      <section className="notice-strong mt-16 max-w-3xl p-6">
        <h2 className="font-display text-lg tracking-wide text-admin-text">Delete this show</h2>

        <ul className="mt-4 space-y-2 text-sm text-admin-text">
          <li>
            <Count n={show.episodes.length} one="episode" many="episodes" />{" "}
            {show.episodes.length === 1 ? "is" : "are"} deleted with it. Episodes cascade —
            they cannot exist without a show.
          </li>
          <li>
            <Count n={show._count.leads} one="lead" many="leads" />{" "}
            {show._count.leads === 1 ? "is" : "are"} kept. They lose their link to this show
            and nothing else, so no entry is ever lost to a content edit.
          </li>
          <li>
            <Count n={show._count.winners} one="winner" many="winners" />,{" "}
            <Count n={show._count.gallery} one="gallery image" many="gallery images" /> and{" "}
            <Count n={show._count.campaigns} one="campaign" many="campaigns" /> are kept and
            detached the same way.
          </li>
        </ul>

        <p className="mt-4 text-sm text-admin-muted">
          There is almost always a better option.{" "}
          <span className="text-admin-text">Closed</span> or{" "}
          <span className="text-admin-text">Archived</span> keeps a finished season on the site as
          a past season; <span className="text-admin-text">Draft</span> removes it from the public
          site entirely. Both keep the episodes.
        </p>

        <div className="mt-5">
          {session.role === "OWNER" ? (
            <DeleteButton
              action={deleteShow.bind(null, show.id)}
              name={show.title}
              label="Delete show"
              redirectTo="/admin/shows"
            />
          ) : (
            <p className="text-xs uppercase tracking-widest text-admin-faint">
              Owner only
            </p>
          )}
        </div>
      </section>
    </>
  );
}

/** "3 episodes" / "1 lead" — the number emphasised, the noun agreeing with it. */
function Count({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <>
      <span className="text-admin-text">{n}</span> {n === 1 ? one : many}
    </>
  );
}

/** A comma-separated run of links to other shows, used in the hero warnings. */
function ShowLinks({ shows }: { shows: { id: string; title: string }[] }) {
  return (
    <>
      {shows.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ", "}
          <Link href={`/admin/shows/${s.id}`} className="text-brand-onDark hover:underline">
            {s.title}
          </Link>
        </span>
      ))}
    </>
  );
}
