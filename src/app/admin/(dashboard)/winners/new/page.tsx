import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { AdminPageHeader, CrudForm, Field, Select, TextArea } from "@/components/admin/crud";
import { createWinner } from "@/app/admin/winners-actions";

export const dynamic = "force-dynamic";

export default async function NewWinnerPage() {
  await requireRole("EDITOR");

  const shows = await prisma.show.findMany({
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <>
      <Link href="/admin/winners" className="btn-quiet">
        Back to winners
      </Link>

      <div className="mt-6">
        <AdminPageHeader
          title="New winner"
          description="Publishes to /winners as soon as it saves. Leave anything the client has not confirmed blank — an empty field renders as a gap, an invented one renders as a fact."
        />
      </div>

      <div className="card mt-8 max-w-3xl p-7">
        <CrudForm action={createWinner} submitLabel="Publish winner" redirectTo="/admin/winners">
          <Field
            label="Name"
            name="name"
            required
            placeholder="PJ Galloway"
            help="Exactly as the client wants it published."
          />

          <Field
            label="URL slug"
            name="slug"
            placeholder="Leave blank to build it from the name"
            help="The public address: /winners/pj-galloway. Lowercase, hyphens, no spaces."
          />

          <Select
            label="Show"
            name="showId"
            options={shows.map((s) => ({ value: s.id, label: s.title }))}
            placeholder="Not linked to a show"
            help="Which competition they won. The show's key art backs the portrait when there is no photograph."
          />

          <Field label="Country" name="country" placeholder="United States" />

          <Field
            label="Prize awarded"
            name="prizeAwarded"
            type="number"
            placeholder="1000"
            help="Whole US dollars, digits only. Blank if the prize was not cash or is unconfirmed."
          />

          <Field
            label="Announced"
            name="announcedAt"
            type="datetime-local"
            help="When the result was announced. Blank until the client confirms the date — the old site gives two."
          />

          <MediaPathHelp />

          <Field
            label="Portrait path"
            name="photoUrl"
            span
            placeholder="/media/winners/pj-galloway"
            help="Site path with NO file extension. Blank is a valid answer: the page then renders a designed stand-in instead of a broken image."
          />

          <Field
            label="Performance link"
            name="videoUrl"
            span
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            help="YouTube or Facebook link to the winning performance. Full URL."
          />

          <TextArea
            label="Story"
            name="story"
            rows={7}
            placeholder="In the client's words."
            help="Shown on the winner's page. Use the client's wording — do not write it for them."
          />
        </CrudForm>
      </div>
    </>
  );
}

/**
 * Repeated on the edit screen. Inlined rather than shared because a new file is
 * outside this task's scope; if a third screen needs it, lift it into crud.tsx.
 */
function MediaPathHelp() {
  return (
    <div className="rounded-card border border-ink-line bg-ink-raised p-5 sm:col-span-2">
      <p className="eyebrow">Image paths</p>
      <p className="mt-2 text-sm leading-relaxed text-chalk-body">
        Store the path <strong className="text-chalk">without a file extension</strong>. The site
        serves three encodings of every image and lets the browser take the smallest one it can
        decode.
      </p>
      <p className="mt-3 text-xs text-chalk-faint">
        <code className="text-brand">/media/winners/pj-galloway</code> is requested as{" "}
        <code>.avif</code>, then <code>.webp</code>, then <code>.jpg</code>. Typing{" "}
        <code>/media/winners/pj-galloway.jpg</code> would ask for{" "}
        <code>pj-galloway.jpg.avif</code> and show nothing, so it is rejected on save.
      </p>
    </div>
  );
}
