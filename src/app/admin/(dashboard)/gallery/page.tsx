import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { mediaImage } from "@/lib/media";
import { Picture } from "@/components/media/Picture";
import {
  AdminPageHeader,
  CrudForm,
  DeleteButton,
  EmptyState,
  Field,
  Select,
  StatusPill,
  TextArea,
} from "@/components/admin/crud";
import { createGalleryImage, deleteGalleryImage, updateGalleryImage } from "@/app/admin/gallery-actions";

export const dynamic = "force-dynamic";

/** getGallery() in src/lib/queries.ts takes this many for the homepage strip. */
const HOMEPAGE_LIMIT = 12;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The gallery manager: one panel, one list.
 *
 * Which image is being edited lives in the URL (?edit=<id>) rather than in
 * component state, for two reasons. It makes a half-finished edit shareable and
 * refreshable like the leads filters, and it guarantees exactly one form is
 * mounted at a time — the shared Field kit derives input ids from the field
 * name, so twenty-two edit forms on one page would mean twenty-two inputs all
 * called "f-alt" and every label pointing at the first one.
 *
 * Reordering is a plain number field. Drag-and-drop over a wrapping grid of
 * twenty-plus images is worse on a phone, unusable with a keyboard, and needs a
 * dependency to do properly.
 */
export default async function GalleryPage({ searchParams }: Props) {
  const user = await requireRole("EDITOR");
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" ? sp.edit : undefined;

  const [images, shows] = await Promise.all([
    prisma.galleryImage.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { show: { select: { title: true } } },
    }),
    prisma.show.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  const showOptions = shows.map((s) => ({ value: s.id, label: s.title }));
  const editing = editId ? (images.find((i) => i.id === editId) ?? null) : null;
  const nextOrder = images.length === 0 ? 0 : Math.max(...images.map((i) => i.sortOrder)) + 10;

  const typedPath = typeof sp.preview === "string" ? sp.preview.trim() : "";
  const preview = checkPath(typedPath);

  return (
    <>
      <AdminPageHeader
        title="Gallery"
        description={`Ordered lowest number first. The homepage strip shows the first ${HOMEPAGE_LIMIT}; the rest are stored and ready for the show pages.`}
        action={
          editing ? (
            <Link href="/admin/gallery" className="btn btn-ghost">
              Add an image instead
            </Link>
          ) : undefined
        }
      />

      <AltTextRule />

      {editId && !editing && (
        <p className="error-text mt-6" role="alert">
          That image no longer exists — it may have been deleted in another tab.{" "}
          <Link href="/admin/gallery" className="underline">
            Back to the gallery
          </Link>
          .
        </p>
      )}

      <PathChecker typedPath={typedPath} preview={preview} editId={editId} />

      {/* One form on the page at a time: the edit panel replaces the add panel. */}
      <div className="card mt-6 max-w-3xl p-7">
        <p className="eyebrow">{editing ? "Editing an image" : "Add an image"}</p>

        {editing && (
          <div className="mt-5 flex gap-5">
            <div className="aspect-[3/4] w-28 shrink-0 overflow-hidden border border-admin-line-strong bg-admin-raised">
              <Picture src={editing.url} alt="" sizes="112px" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-admin-faint">
                Files requested, in order
              </p>
              <ul className="mt-2 space-y-1">
                {[".avif", ".webp", ".jpg"].map((ext) => (
                  <li key={ext} className="break-all font-mono text-xs text-admin-muted">
                    {mediaImage(editing.url)}
                    <span className="text-brand-onDark">{ext}</span>
                  </li>
                ))}
              </ul>
              <p className="help">
                An empty frame means no file exists at that path. Fix the path, save, and it
                appears here.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6">
          {editing ? (
            <CrudForm
              key={editing.id}
              action={updateGalleryImage}
              submitLabel="Save image"
              redirectTo="/admin/gallery"
            >
              <input type="hidden" name="id" value={editing.id} />
              <GalleryFields
                showOptions={showOptions}
                defaults={{
                  url: editing.url,
                  alt: editing.alt,
                  caption: editing.caption,
                  showId: editing.showId,
                  width: editing.width,
                  height: editing.height,
                  sortOrder: editing.sortOrder,
                }}
              />
            </CrudForm>
          ) : (
            <CrudForm
              key={`add-${images.length}`}
              action={createGalleryImage}
              submitLabel="Add image"
            >
              <GalleryFields showOptions={showOptions} defaults={{ sortOrder: nextOrder }} />
            </CrudForm>
          )}
        </div>

        {editing && user.role === "OWNER" && (
          <div className="mt-8 border-t border-admin-line pt-6">
            <p className="text-xs text-admin-faint">
              Removing the row does not delete the file in /media, so the same path can be added
              back later.
            </p>
            <div className="mt-3">
              <DeleteButton
                action={deleteGalleryImage.bind(null, editing.id)}
                name={editing.url}
                label="Remove from gallery"
                redirectTo="/admin/gallery"
              />
            </div>
          </div>
        )}
      </div>

      {images.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No images yet"
            body="Add the first one above. The homepage strip stays hidden entirely until there is something to put in it, so an empty gallery costs nothing."
          />
        </div>
      ) : (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl tracking-wide">
              {images.length} image{images.length === 1 ? "" : "s"}
            </h2>
            <p className="text-xs text-admin-faint">
              Lower order numbers come first. Leave gaps — 10, 20, 30 — so a new image can be
              slotted in without renumbering the set.
            </p>
          </div>

          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((image, index) => {
              const active = editing?.id === image.id;
              return (
                <li
                  key={image.id}
                  className={
                    active
                      ? "overflow-hidden border-2 border-brand bg-admin-panel"
                      : "overflow-hidden border-2 border-admin-line-strong bg-admin-panel"
                  }
                >
                  {/* Same 3:4 crop the homepage strip uses, on the same filled
                      panel, so what is judged here is what ships. */}
                  <div className="relative aspect-[3/4] bg-admin-raised">
                    {/* alt="" here on purpose: the alt text is printed as visible
                        text directly below, and repeating it on the image makes
                        a screen reader announce every card twice. */}
                    <Picture src={image.url} alt="" sizes="(min-width: 1280px) 20vw, 40vw" />
                    <span className="absolute left-3 top-3 bg-admin-sunk/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-admin-text">
                      #{image.sortOrder}
                    </span>
                    {index >= HOMEPAGE_LIMIT && (
                      <span className="absolute right-3 top-3">
                        <StatusPill value="Not on homepage" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 p-4">
                    <p className="text-sm leading-snug text-admin-text">{image.alt}</p>
                    {image.caption && (
                      <p className="text-xs text-admin-faint">{image.caption}</p>
                    )}
                    <p className="break-all font-mono text-[11px] text-admin-faint">{image.url}</p>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-[10px] uppercase tracking-widest text-admin-faint">
                        {image.show?.title ?? "No show"}
                      </span>
                      <Link
                        href={`/admin/gallery?edit=${image.id}`}
                        className="text-xs font-semibold uppercase tracking-widest text-admin-muted transition-colors hover:text-brand-onDark"
                      >
                        {active ? "Editing" : "Edit"}
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

/* ---------------------------------------------------------- path checker */

const IMAGE_EXTENSION = /\.(avif|webp|jpe?g|png|gif|svg)$/i;
const SITE_PATH = /^\/[A-Za-z0-9][A-Za-z0-9/_-]*$/;

type PathCheck =
  | { state: "empty" }
  | { state: "extension" }
  | { state: "malformed" }
  | { state: "ok"; path: string };

/**
 * Mirrors the rule enforced in gallery-actions.ts. Duplicated rather than
 * imported because a "use server" module can only export server actions, so the
 * regex cannot be shared from there without publishing it as an endpoint.
 *
 * The strict character class is also what makes it safe to render the typed
 * value straight into an <img src>: only a leading slash, letters, digits,
 * slash, underscore and hyphen ever get through.
 */
function checkPath(value: string): PathCheck {
  if (!value) return { state: "empty" };
  if (IMAGE_EXTENSION.test(value)) return { state: "extension" };
  if (value.length > 200 || !SITE_PATH.test(value)) return { state: "malformed" };
  return { state: "ok", path: value };
}

/**
 * Type a path, see whether a file actually sits there — before it is saved and
 * before it reaches the homepage.
 *
 * A plain GET form rather than a controlled input, so the whole screen stays a
 * Server Component and the checked path is in the URL: an editor can paste it to
 * a colleague and they see the same result. It costs one round trip, which is
 * the honest trade for not shipping a client bundle to preview a filename.
 */
function PathChecker({
  typedPath,
  preview,
  editId,
}: {
  typedPath: string;
  preview: PathCheck;
  editId?: string;
}) {
  return (
    <div className="mt-6 border border-admin-line-strong bg-admin-raised p-6">
      <form method="get" action="/admin/gallery" className="flex flex-wrap items-end gap-3">
        {editId && <input type="hidden" name="edit" value={editId} />}
        <div className="min-w-[16rem] flex-1">
          <label className="label" htmlFor="path-check">
            Check a path before you save
          </label>
          <input
            id="path-check"
            name="preview"
            type="text"
            defaultValue={typedPath}
            placeholder="/media/gallery/cts-01"
            className="field"
          />
        </div>
        <button type="submit" className="btn btn-ghost">
          Preview
        </button>
      </form>

      {editId && (
        <p className="help">
          This reloads the page, so save any other changes to the image below first.
        </p>
      )}

      {preview.state === "extension" && (
        <p className="error-text" role="alert">
          Drop the file extension. The site appends .avif, .webp and .jpg itself.
        </p>
      )}

      {preview.state === "malformed" && (
        <p className="error-text" role="alert">
          Use a site path such as /media/gallery/cts-01 — a leading slash, no domain, no spaces.
        </p>
      )}

      {preview.state === "ok" && (
        <div className="mt-5 flex flex-wrap gap-5">
          <div className="aspect-[3/4] w-32 shrink-0 overflow-hidden border border-admin-line-strong bg-admin-raised">
            <Picture src={preview.path} alt="" sizes="128px" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-admin-faint">
              Files the browser will try, in order
            </p>
            <ul className="mt-2 space-y-1">
              {[".avif", ".webp", ".jpg"].map((ext) => (
                <li key={ext} className="break-all font-mono text-xs text-admin-muted">
                  {mediaImage(preview.path)}
                  <span className="text-brand-onDark">{ext}</span>
                </li>
              ))}
            </ul>
            <p className="help">
              An image above means the path is right. An empty frame means nothing is at that path
              yet — check the filename in public/media before saving it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

type Defaults = {
  url?: string;
  alt?: string;
  caption?: string | null;
  showId?: string | null;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
};

function GalleryFields({
  showOptions,
  defaults,
}: {
  showOptions: { value: string; label: string }[];
  defaults: Defaults;
}) {
  return (
    <>
      <Field
        label="Image path"
        name="url"
        span
        required
        defaultValue={defaults.url}
        placeholder="/media/gallery/cts-01"
        help="Site path with NO file extension. The site appends .avif, .webp and .jpg and the browser takes the smallest it can decode — typing /media/gallery/cts-01.jpg would request cts-01.jpg.avif and show nothing, so it is rejected on save."
      />

      <TextArea
        label="Alt text"
        name="alt"
        rows={3}
        required
        defaultValue={defaults.alt}
        placeholder="The crowd during a live round"
        help="Describe the scene, not the people. Nobody in these photographs is identified anywhere on the old site, so we cannot name them — and a screen-reader user gets nothing from a filename. Skip “image of”; it is already announced as an image."
      />

      <Field
        label="Caption"
        name="caption"
        span
        defaultValue={defaults.caption}
        help="Optional. Stored for the show pages — the homepage strip does not display captions today."
      />

      <Select
        label="Show"
        name="showId"
        options={showOptions}
        defaultValue={defaults.showId}
        placeholder="Not linked to a show"
        help="Groups the image with a show so a show page can pull its own set."
      />

      <Field
        label="Order"
        name="sortOrder"
        type="number"
        defaultValue={defaults.sortOrder}
        help={`Lowest first. The homepage shows the first ${HOMEPAGE_LIMIT}.`}
      />

      <Field
        label="Width (px)"
        name="width"
        type="number"
        defaultValue={defaults.width}
        help="Optional. Recorded for future layout use."
      />

      <Field
        label="Height (px)"
        name="height"
        type="number"
        defaultValue={defaults.height}
        help="Optional. The strip crops to 3:4 today."
      />
    </>
  );
}

/**
 * The alt-text rule gets its own panel rather than a line of help text. It is the
 * one field on this screen that cannot be fixed later by looking at the page —
 * a wrong image is obvious, missing alt text is invisible to everyone who can
 * see.
 */
function AltTextRule() {
  return (
    <div className="mt-6 border border-admin-line-strong bg-admin-raised p-6">
      <p className="eyebrow">Alt text is required</p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-admin-text">
        Every image needs a description of <strong className="text-admin-text">the scene</strong> — what
        is happening, where, and with what energy. Not who is in it:{" "}
        <span className="text-admin-text">nobody in these photographs is identified anywhere on the
        old site</span>, so naming a person here would be a guess published as a fact.
      </p>
      <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
        <p className="text-admin-muted">
          <span className="text-brand-onDark">Good</span> — “The crowd during a live round”,
          “Contestant mid-performance under the stage lights”, “Judges watching from the front row”.
        </p>
        <p className="text-admin-faint">
          <span className="text-brand-onDark">Rejected</span> — “photo”, “cts-01”, a pasted file
          path, or anything under eight characters. It passes a required check and tells a
          screen-reader user nothing.
        </p>
      </div>
    </div>
  );
}
