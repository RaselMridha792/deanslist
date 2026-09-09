"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Checkbox,
  CrudForm,
  DeleteButton,
  Field,
  Select,
  TextArea,
} from "@/components/admin/crud";
import { savePromotion, deletePromotion } from "@/app/admin/promotion-actions";

export type PromotionRow = {
  id: string;
  slug: string;
  title: string;
  kicker: string | null;
  tagline: string | null;
  summary: string;
  body: string | null;
  steps: string | null;
  prizeTitle: string | null;
  prizeNote: string | null;
  hashtags: string | null;
  imagePath: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  status: string;
  showId: string | null;
  sortOrder: number;
  entryEnabled: boolean;
  entryHeading: string | null;
  entryBlurb: string | null;
  entryButtonLabel: string | null;
  entryAskPhone: boolean;
  entryAskCity: boolean;
  entryAskGroupSize: boolean;
  entryAskLink: boolean;
  entryQuestion: string | null;
};

const STATUS = [
  { value: "DRAFT", label: "Draft — not on the site" },
  { value: "RUNNING", label: "Running — live, marked as open" },
  { value: "ENDED", label: "Ended — still on the site, marked as closed" },
];

/**
 * One form for a campaign, new or existing.
 *
 * The steps field is the only thing here that needs explaining, so its help
 * text carries a worked example rather than a description. An editor copying a
 * shape gets it right; an editor reading "blank line separated" has to imagine
 * it.
 */
export function PromotionEditor({
  promotion,
  shows,
  onDone,
}: {
  promotion?: PromotionRow;
  shows: { id: string; title: string }[];
  onDone?: () => void;
}) {
  const editing = Boolean(promotion);

  return (
    <CrudForm
      action={savePromotion}
      submitLabel={editing ? "Save changes" : "Create campaign"}
      onSaved={onDone}
    >
      {editing && <input type="hidden" name="id" value={promotion!.id} />}

      <Field
        name="title"
        label="Title"
        defaultValue={promotion?.title}
        required
        help={
          editing
            ? `Its address stays /campaigns/${promotion!.slug}. Renaming would break every link already shared, including one in a running ad.`
            : "The address is made from this and never changes afterwards."
        }
      />

      <Select
        name="status"
        label="Status"
        defaultValue={promotion?.status ?? "DRAFT"}
        options={STATUS}
        placeholder=""
        help="Ended campaigns stay on the site. A contest that finished is proof the contest is real."
      />

      <Field
        name="kicker"
        label="Kicker"
        defaultValue={promotion?.kicker ?? ""}
        help="The small label above the title. Dean's List presents, Open call."
      />

      <Field
        name="tagline"
        label="Tagline"
        defaultValue={promotion?.tagline ?? ""}
        help="The line the page ends on, set large. Host it. Snap it. Post it."
      />

      <TextArea
        name="summary"
        label="Summary"
        defaultValue={promotion?.summary}
        required
        rows={3}
        help="One or two sentences. This is the whole of the card on the campaigns index, so a campaign without it would be a blank card."
      />

      <TextArea
        name="body"
        label="Description"
        defaultValue={promotion?.body ?? ""}
        rows={6}
        help="The longer explanation. A blank line starts a new paragraph."
      />

      <div className="sm:col-span-2">
        <TextArea
          name="steps"
          label="How it works"
          defaultValue={promotion?.steps ?? ""}
          rows={10}
          help="One step per block, with a blank line between blocks. The first line of a block is its heading and the rest become its bullets. The numbers are added by the page, so reordering here renumbers there."
        />
        {/* Shown, not described. `help` renders inside a paragraph, where the
            line breaks that ARE the format would collapse into one run-on line
            and demonstrate the opposite of the thing being explained. */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs uppercase tracking-widest text-admin-faint hover:text-brand-onDark">
            Show an example
          </summary>
          <pre className="mt-3 overflow-x-auto border-2 border-admin-line bg-admin-raised p-4 text-[12px] leading-relaxed text-admin-muted">
            {`Throw the party
Host a watch party for Drop That Mike.
Gather your crew and set the scene, minimum of five.

Show up live
Post photos and videos in the comments during the show.
Engage and vote throughout. Energy counts.

The winning watch party
The audience votes before the end of the show.`}
          </pre>
        </details>
      </div>

      <Field
        name="prizeTitle"
        label="Prize"
        defaultValue={promotion?.prizeTitle ?? ""}
        help="4 days, 3 nights luxury destination stay."
      />

      <Field
        name="hashtags"
        label="Hashtags"
        defaultValue={promotion?.hashtags ?? ""}
        help="Separated by spaces. The hash is optional, it is added if missing."
      />

      <TextArea
        name="prizeNote"
        label="Prize small print"
        defaultValue={promotion?.prizeNote ?? ""}
        rows={3}
        help="What the prize does not cover. Room accommodations only, winner covers travel and taxes."
      />

      <Field
        name="imagePath"
        label="Poster"
        defaultValue={promotion?.imagePath ?? ""}
        help="A media path with no file extension, like /media/campaigns/watch-party-contest, or a full https:// URL."
      />

      <Select
        name="showId"
        label="Runs alongside"
        defaultValue={promotion?.showId ?? ""}
        options={shows.map((s) => ({ value: s.id, label: s.title }))}
        placeholder="No particular show"
      />

      <Field
        name="ctaLabel"
        label="Button label"
        defaultValue={promotion?.ctaLabel ?? ""}
        help="Leave both button fields empty for no button."
      />

      <Field
        name="ctaHref"
        label="Button link"
        defaultValue={promotion?.ctaHref ?? ""}
        help="/register for a page on this site, or a full https:// URL."
      />

      <Field
        name="sortOrder"
        label="Order"
        type="number"
        defaultValue={String(promotion?.sortOrder ?? 0)}
        help="Lower shows first, within its status."
      />

      {/* --------------------------------------------------- entry form */}
      <div className="sm:col-span-2 border-t-2 border-admin-line pt-6">
        <p className="eyebrow">Entry form</p>
        <p className="mt-2 max-w-[70ch] text-sm text-admin-muted">
          Switch this on and the campaign page gets its own sign-up form, and
          the entries arrive in Leads tagged with this campaign. Name and email
          are always asked; the rest are up to you. The form only shows while
          the campaign is Running — collecting entries to a closed contest is
          worse than collecting none.
        </p>
      </div>

      <Checkbox
        name="entryEnabled"
        label="Take entries on this campaign's page"
        defaultChecked={promotion?.entryEnabled ?? false}
      />

      <Field
        name="entryButtonLabel"
        label="Entry button label"
        defaultValue={promotion?.entryButtonLabel ?? ""}
        help='Defaults to "Send my entry".'
      />

      <Field
        name="entryHeading"
        label="Entry form heading"
        defaultValue={promotion?.entryHeading ?? ""}
        help="Defaults to Enter, then the campaign title."
      />

      <Field
        name="entryQuestion"
        label="One extra question"
        defaultValue={promotion?.entryQuestion ?? ""}
        help='Asked exactly as written. "Where are you watching from?" Leave empty for none.'
      />

      <TextArea
        name="entryBlurb"
        label="Entry form note"
        defaultValue={promotion?.entryBlurb ?? ""}
        rows={2}
        help="A line under the heading. What happens after they enter, or what you need from them."
      />

      <Checkbox
        name="entryAskPhone"
        label="Ask for a phone number"
        defaultChecked={promotion?.entryAskPhone ?? true}
      />

      <Checkbox
        name="entryAskCity"
        label="Ask where they are"
        defaultChecked={promotion?.entryAskCity ?? true}
      />

      <Checkbox
        name="entryAskGroupSize"
        label="Ask how many people"
        defaultChecked={promotion?.entryAskGroupSize ?? false}
      />

      <Checkbox
        name="entryAskLink"
        label="Ask for a link"
        defaultChecked={promotion?.entryAskLink ?? false}
      />
    </CrudForm>
  );
}

/** The index row's expand-to-edit, so editing never leaves the list. */
export function PromotionCard({
  promotion,
  shows,
  entryCount,
}: {
  promotion: PromotionRow;
  shows: { id: string; title: string }[];
  entryCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-admin-text">
              {promotion.title}
            </h2>
            <span
              className={
                promotion.status === "RUNNING"
                  ? "pill border-brand bg-brand text-white"
                  : promotion.status === "ENDED"
                    ? "pill border-admin-line-strong bg-admin-raised text-admin-muted"
                    : "pill border-admin-note/60 bg-admin-note-tint text-admin-note"
              }
            >
              {promotion.status}
            </span>
          </div>
          <p className="mt-2 max-w-[70ch] text-sm text-admin-muted">
            {promotion.summary}
          </p>
          {/* The number is the reason the form exists, so it goes where the
              status is rather than three clicks away in Leads. */}
          {(promotion.entryEnabled || entryCount > 0) && (
            <p className="mt-3">
              <Link
                href={`/admin/leads?promotion=${promotion.slug}`}
                className="inline-flex items-baseline gap-2 border-2 border-admin-line-strong px-3 py-1.5 transition-colors hover:border-brand-onDark"
              >
                <span className="text-lg font-extrabold tabular-nums text-admin-text">
                  {entryCount}
                </span>
                <span className="text-eyebrow font-semibold uppercase text-admin-faint">
                  {entryCount === 1 ? "entry" : "entries"}
                </span>
              </Link>
              {!promotion.entryEnabled && entryCount > 0 && (
                <span className="ml-3 text-xs text-admin-faint">
                  form is switched off
                </span>
              )}
            </p>
          )}

          <p className="mt-2 text-xs text-admin-faint">
            /campaigns/{promotion.slug}
            {promotion.status !== "DRAFT" && (
              <>
                {" · "}
                <Link
                  href={`/campaigns/${promotion.slug}`}
                  target="_blank"
                  className="text-brand-onDark hover:underline"
                >
                  View on the site
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-quiet"
          >
            {open ? "Close" : "Edit"}
          </button>
          <DeleteButton
            action={async () => deletePromotion(promotion.id)}
            name={promotion.title}
            label="Delete"
          />
        </div>
      </div>

      {open && (
        <div className="mt-6 border-t-2 border-admin-line pt-6">
          <PromotionEditor
            promotion={promotion}
            shows={shows}
            onDone={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
