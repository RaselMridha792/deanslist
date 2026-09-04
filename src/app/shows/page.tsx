import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";
import { Badge } from "@/components/ui/Badge";
import { Picture } from "@/components/media/Picture";
import { getShows } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Shows & Events",
  description:
    "Every Dean's List show and challenge — Drop That Mike, Crown the Sound, and what is coming next.",
};

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  LIVE: "Live now",
  OPEN: "Entries open",
  CLOSED: "Season closed",
  ARCHIVED: "Archived",
};

export default async function ShowsPage() {
  const shows = await getShows();
  const open = shows.filter((s) => s.status === "LIVE" || s.status === "OPEN");
  const past = shows.filter((s) => s.status !== "LIVE" && s.status !== "OPEN");

  return (
    <>
      <PageHero
        eyebrow="Shows & events"
        title="Every stage we run"
        lede="Two show brands, one platform. Enter whichever one fits your talent."
        image="/media/shows/drop-that-mike-key-art"
      />

      {open.length > 0 && (
        <section className="section border-b border-ink-line">
          <div className="shell">
            <p className="eyebrow">Taking entries</p>
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              {open.map((s) => (
                <ShowCard key={s.slug} show={s} featured />
              ))}
            </div>
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="section">
          <div className="shell">
            <p className="eyebrow">Past seasons</p>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((s) => (
                <ShowCard key={s.slug} show={s} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function ShowCard({
  show,
  featured = false,
}: {
  show: Awaited<ReturnType<typeof getShows>>[number];
  featured?: boolean;
}) {
  return (
    <Link
      href={`/shows/${show.slug}`}
      className="card-interactive group block overflow-hidden"
    >
      <div className={featured ? "relative aspect-[16/10]" : "relative aspect-[4/3]"}>
        {show.keyArt ? (
          <Picture
            src={show.keyArt}
            alt=""
            sizes={featured ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 33vw, 100vw"}
            imgClassName="transition-transform duration-slow ease-cine group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-ink-high" />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />

        <span className="absolute left-5 top-5 flex gap-2">
          {show.status === "LIVE" ? (
            <Badge live>{STATUS_LABEL.LIVE}</Badge>
          ) : (
            <Badge>{STATUS_LABEL[show.status] ?? show.status}</Badge>
          )}
        </span>
      </div>

      <div className="p-7">
        <h2 className={featured ? "text-display-sm uppercase" : "text-2xl uppercase tracking-wide"}>
          {show.title}
        </h2>
        {show.tagline && <p className="mt-2 text-sm text-gold">{show.tagline}</p>}
        {show.description && (
          <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-chalk-muted">
            {show.description}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-widest text-chalk-faint">
          {show.cadence && <span>{show.cadence}</span>}
          {show.prizeAmount !== null && (
            <span className="text-gold">${show.prizeAmount.toLocaleString("en-US")} prize</span>
          )}
        </div>
      </div>
    </Link>
  );
}
