import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { mediaImage } from "@/lib/media";
import { WinnerPortrait } from "@/components/media/WinnerPortrait";
import {
  AdminPageHeader,
  CrudForm,
  DeleteButton,
  Field,
  Select,
  TextArea,
} from "@/components/admin/crud";
import { deleteWinner, updateWinner } from "@/app/admin/winners-actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditWinnerPage({ params }: Props) {
  const user = await requireRole("EDITOR");
  const { id } = await params;

  const [winner, shows] = await Promise.all([
    prisma.winner.findUnique({
      where: { id },
      include: { show: { select: { id: true, title: true, heroImageUrl: true } } },
    }),
    prisma.show.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  if (!winner) notFound();

  return (
    <>
      <Link href="/admin/winners" className="btn-quiet">
        Back to winners
      </Link>

      <div className="mt-6">
        <AdminPageHeader
          title={winner.name}
          description={`Published at /winners/${winner.slug}`}
          action={
            <a
              href={`/winners/${winner.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              View public page
            </a>
          }
        />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <div className="card p-7">
          <CrudForm action={updateWinner} submitLabel="Save changes">
            <input type="hidden" name="id" value={winner.id} />

            <Field
              label="Name"
              name="name"
              required
              defaultValue={winner.name}
              help="Exactly as the client wants it published."
            />

            <Field
              label="URL slug"
              name="slug"
              defaultValue={winner.slug}
              help="Changing this changes the public address and breaks any existing link to it. Clear the field to rebuild it from the name."
            />

            <Select
              label="Show"
              name="showId"
              options={shows.map((s) => ({ value: s.id, label: s.title }))}
              defaultValue={winner.showId}
              placeholder="Not linked to a show"
              help="The show's key art backs the portrait when there is no photograph."
            />

            <Field label="Country" name="country" defaultValue={winner.country} />

            <Field
              label="Prize awarded"
              name="prizeAwarded"
              type="number"
              defaultValue={winner.prizeAwarded}
              help="Whole US dollars, digits only. Blank if unconfirmed."
            />

            <Field
              label="Announced"
              name="announcedAt"
              type="datetime-local"
              defaultValue={toLocalInput(winner.announcedAt)}
              help="Blank until the client confirms the date."
            />

            <MediaPathHelp />

            <Field
              label="Portrait path"
              name="photoUrl"
              span
              defaultValue={winner.photoUrl}
              placeholder="/media/winners/pj-galloway"
              help="Site path with NO file extension. Blank renders the designed stand-in shown on the right."
            />

            <Field
              label="Performance link"
              name="videoUrl"
              span
              type="url"
              defaultValue={winner.videoUrl}
              placeholder="https://www.youtube.com/watch?v=..."
              help="YouTube or Facebook link to the winning performance."
            />

            <TextArea
              label="Story"
              name="story"
              rows={9}
              defaultValue={winner.story}
              help="Use the client's wording — do not write it for them."
            />
          </CrudForm>

          {user.role === "OWNER" && (
            <div className="mt-8 border-t border-rule pt-6">
              <p className="text-xs text-neutral-600">
                Deleting removes the winner and the public page at /winners/{winner.slug}. The
                image files in /media are untouched.
              </p>
              <div className="mt-3">
                <DeleteButton
                  action={deleteWinner.bind(null, winner.id)}
                  name={winner.name}
                  label="Delete this winner"
                  redirectTo="/admin/winners"
                />
              </div>
            </div>
          )}
        </div>

        {/* The preview is the real component the public page uses, rendered from
            the saved values — so it shows the stand-in for a missing portrait
            exactly as a visitor would see it, rather than a broken-image icon
            that reads like a bug. */}
        <aside className="space-y-4">
          <div className="card p-5">
            <p className="eyebrow">What /winners/{winner.slug} renders</p>
            <div className="mt-4">
              <WinnerPortrait
                name={winner.name}
                photoUrl={winner.photoUrl}
                fallbackImage={winner.show?.heroImageUrl}
                sizes="360px"
                className="aspect-[4/5]"
              />
            </div>

            {winner.photoUrl ? (
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                  Files requested, in order
                </p>
                <ul className="mt-2 space-y-1">
                  {[".avif", ".webp", ".jpg"].map((ext) => (
                    <li key={ext} className="break-all font-mono text-xs text-neutral-700">
                      {mediaImage(winner.photoUrl ?? "")}
                      <span className="text-brand">{ext}</span>
                    </li>
                  ))}
                </ul>
                <p className="help">
                  A blank frame above means none of these files exist at that path yet.
                </p>
              </div>
            ) : (
              <p className="help mt-4">
                No portrait path set, so the page renders the stand-in above. That is deliberate:
                there is no photograph of this winner anywhere on the old site, and putting an
                unidentified person from the gallery under a named winner is not an option.
              </p>
            )}
          </div>

          <div className="card p-5">
            <p className="eyebrow">Publishing checks</p>
            <ul className="mt-3 space-y-2 text-sm text-ink">
              <Check ok={Boolean(winner.announcedAt)} label="Announcement date confirmed" />
              <Check ok={Boolean(winner.showId)} label="Linked to a show" />
              <Check ok={winner.prizeAwarded !== null} label="Prize recorded" />
              <Check ok={Boolean(winner.story)} label="Story written by the client" />
              <Check ok={Boolean(winner.videoUrl)} label="Performance video linked" />
            </ul>
            <p className="help">
              These are prompts, not requirements. A blank field publishes as a gap; never fill one
              with a guess.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={
          ok
            ? "mt-1.5 h-1.5 w-1.5 shrink-0  bg-brand"
            : "mt-1.5 h-1.5 w-1.5 shrink-0  bg-neutral-400"
        }
      />
      <span className={ok ? "text-ink" : "text-neutral-600"}>
        {label}
        <span className="sr-only">{ok ? " — done" : " — outstanding"}</span>
      </span>
    </li>
  );
}

/** See the note on the same helper in ../new/page.tsx. */
function MediaPathHelp() {
  return (
    <div className="border border-rule bg-surface p-5 sm:col-span-2">
      <p className="eyebrow">Image paths</p>
      <p className="mt-2 text-sm leading-relaxed text-ink">
        Store the path <strong className="text-ink">without a file extension</strong>. The site
        serves three encodings of every image and lets the browser take the smallest one it can
        decode.
      </p>
      <p className="mt-3 text-xs text-neutral-600">
        <code className="text-brand">/media/winners/pj-galloway</code> is requested as{" "}
        <code>.avif</code>, then <code>.webp</code>, then <code>.jpg</code>. Typing{" "}
        <code>/media/winners/pj-galloway.jpg</code> would ask for{" "}
        <code>pj-galloway.jpg.avif</code> and show nothing, so it is rejected on save.
      </p>
    </div>
  );
}

/**
 * Local copy of the helper in crud.tsx. That module carries "use client", and
 * every export of a client module becomes a client reference when a Server
 * Component imports it — calling it here would throw at request time. The fix is
 * a plain src/lib/admin/format.ts, which is outside this task's file list.
 */
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
