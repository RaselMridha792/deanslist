import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createShow } from "@/app/admin/shows-actions";
import {
  AdminPageHeader,
  CrudForm,
  Field,
  Select,
  TextArea,
} from "@/components/admin/crud";

export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/New_York";

/**
 * A short list, not every zone on earth. The team is in Charleston, WV; the
 * audience is global, so the zones an entrant or a co-host is most likely to be
 * in are offered too. Any other valid IANA zone is still accepted server-side.
 */
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

export default async function NewShowPage() {
  await requireRole("EDITOR");

  const now = new Date();
  const zoneOptions = TIME_ZONES.map((tz) => ({
    value: tz,
    label: `${tz.replace(/_/g, " ")} — ${zoneLabel(tz, now)}`,
  }));

  return (
    <>
      <Link href="/admin/shows" className="btn-quiet">
        Back to shows
      </Link>

      <div className="mt-6">
        <AdminPageHeader
          title="New show"
          description="Everything the public site says about a show comes from this record. Save it as a draft first — nothing appears publicly until the status changes."
        />
      </div>

      <div className="mt-8 max-w-3xl">
        <CrudForm action={createShow} submitLabel="Create show" redirectTo="/admin/shows">
          <Field
            label="Title"
            name="title"
            required
            placeholder="Drop That Mike"
            help="Used as the page heading and in every email about this show."
          />

          <Field
            label="URL slug"
            name="slug"
            placeholder="drop-that-mike"
            help="Leave blank to build it from the title. Lowercase letters, numbers and hyphens only — this becomes /shows/your-slug and should never change once shared."
          />

          <Field
            label="Tagline"
            name="tagline"
            placeholder="The only show where you control the cash."
            span
            help="One line. It sits under the title in the hero."
          />

          <TextArea
            label="Description"
            name="description"
            rows={6}
            placeholder="What the show is, how it works, who can enter."
            help="Plain text. Shown on /shows and the show page."
          />

          <Select
            label="Status"
            name="status"
            required
            options={STATUSES}
            defaultValue="DRAFT"
            placeholder="Choose a status"
            help="Only one show should ever be LIVE. LIVE beats OPEN for the homepage hero."
          />

          <Field
            label="Prize amount"
            name="prizeAmount"
            type="number"
            placeholder="1000"
            help="Whole number, no symbols. Leave blank until the client confirms it — never publish a guessed prize."
          />

          <Field
            label="Currency"
            name="currency"
            defaultValue="USD"
            placeholder="USD"
            help="Three-letter code."
          />

          {/* The zone is a real field rather than an assumption. A datetime-local
              input submits a wall clock with no zone attached; whatever is chosen
              here is the zone the two times below are read in, and the instant
              stored is the one that the homepage countdown counts down to. */}
          <Select
            label="Times below are in"
            name="timeZone"
            required
            options={zoneOptions}
            defaultValue={DEFAULT_TZ}
            placeholder="Choose a timezone"
            help="Both times are stored as a precise moment, then shown to every visitor in their own zone."
          />

          <Field
            label="Entry deadline"
            name="entryDeadline"
            type="datetime-local"
            help="Drives the homepage countdown. Leave blank while the date is unconfirmed — the countdown then hides itself rather than counting to a date nobody agreed."
          />

          <Field
            label="Starts at"
            name="startsAt"
            type="datetime-local"
            help="When the show goes on air."
          />

          <Field
            label="Hero image"
            name="heroImageUrl"
            span
            placeholder="/media/shows/drop-that-mike-key-art"
            help="A path under /media, or a full https:// link."
          />

          <Field
            label="Trailer or hero video"
            name="trailerUrl"
            span
            placeholder="/media/hero/mic"
            help="A path under /media (no file extension — the player picks the right format), or a full https:// link."
          />
        </CrudForm>
      </div>

      <p className="mt-8 max-w-3xl text-xs text-chalk-faint">
        Episodes are added on the show&apos;s own page once it exists.
      </p>
    </>
  );
}
