import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader, EmptyState } from "@/components/admin/crud";
import { NewPromotion } from "./NewPromotion";
import { PromotionCard, type PromotionRow } from "./PromotionEditor";

export const dynamic = "force-dynamic";

/**
 * Campaigns: the contests and open calls with public pages.
 *
 * The route is /admin/campaigns-public rather than /admin/campaigns because
 * /admin/campaigns is the email sender and has been since Phase 7. The URL is
 * the ugly half of that compromise; the label in the sidebar is the half the
 * client reads, and there this is "Campaigns" and the sender is "Email".
 */
export default async function PublicCampaignsPage() {
  await requireRole("EDITOR");

  const [rows, shows] = await Promise.all([
    prisma.promotion.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.show.findMany({
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const promotions: PromotionRow[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    kicker: r.kicker,
    tagline: r.tagline,
    summary: r.summary,
    body: r.body,
    steps: r.steps,
    prizeTitle: r.prizeTitle,
    prizeNote: r.prizeNote,
    hashtags: r.hashtags,
    imagePath: r.imagePath,
    ctaLabel: r.ctaLabel,
    ctaHref: r.ctaHref,
    status: r.status,
    showId: r.showId,
    sortOrder: r.sortOrder,
  }));

  const running = promotions.filter((p) => p.status === "RUNNING").length;

  return (
    <>
      <AdminPageHeader
        title="Campaigns"
        description={
          "Contests and open calls with their own page on the site. Add one, and " +
          "/campaigns/its-name exists as soon as you set it to Running."
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <p className="text-sm text-admin-muted">
          {promotions.length === 0
            ? "No campaigns yet."
            : `${promotions.length} campaign${promotions.length === 1 ? "" : "s"}, ${running} running.`}
        </p>
      </div>

      <div className="mt-6">
        <NewPromotion shows={shows} />
      </div>

      {promotions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing here yet"
            body="A campaign is a contest or an open call with its own page: a poster, how it works, and the prize. Create one above."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {promotions.map((p) => (
            <PromotionCard key={p.id} promotion={p} shows={shows} />
          ))}
        </div>
      )}

      <p className="mt-10 max-w-[70ch] text-sm text-admin-faint">
        Draft campaigns are invisible to the public. Ended campaigns stay on the
        site and are labelled as closed, which is deliberate: a contest that
        finished and paid out is the best evidence the next one is real. Delete
        is for a draft that was a mistake.
      </p>
    </>
  );
}
