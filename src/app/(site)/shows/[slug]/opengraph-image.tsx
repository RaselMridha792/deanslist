import { ImageResponse } from "next/og";
import { SITE } from "@/content/site";
import { getShow } from "@/lib/queries";
import { OG, OG_CONTENT_TYPE, OG_BRAND_BAR, OG_SIZE, ogTitleSize } from "@/lib/seo";

/**
 * Per-show share card.
 *
 * A show page shared into a Facebook group is the highest-intent traffic this
 * site gets, and until now every one of those shares rendered as a bare link.
 * The card carries the show name at display scale, its tagline, and the prize
 * when there is a confirmed one.
 *
 * What it does not carry is a date. `Show.startsAt` and `Show.entryDeadline` are
 * null on purpose — the old site announces August 11 on the homepage and dates
 * its own winner story August 28 — so no date is printed here for the same
 * reason `showEventJsonLd()` refuses to emit an Event. A wrong date on a share
 * card outlives the correction, because platforms cache the image.
 *
 * No webfont is fetched: satori's bundled face renders every time, which a
 * network request on a one-core VPS does not.
 */

export const alt = `${SITE.name} — show`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Keep a tagline to one or two lines at 32px on a 1200px card. */
function clamp(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export default async function Image({ params }: { params: { slug: string } }) {
  // A share card must render even when the database does not answer. The query
  // layer rethrows in production by design, which is right for a page and wrong
  // for an image — a 500 here is the broken-preview bug this file exists to fix.
  const show = await getShow(params.slug).catch((err: unknown) => {
    console.error("[og:show] lookup failed:", err);
    return null;
  });

  const title = (show?.title ?? SITE.name).toUpperCase();
  const lede = clamp(show?.tagline ?? show?.description ?? SITE.tagline, 108);

  const live = show?.status === "LIVE";
  const open = show?.status === "OPEN";
  const statusLabel = live ? "LIVE NOW" : open ? "ENTRIES OPEN" : "SEASON CLOSED";
  // Red is urgency and nothing else, so only a live show gets it.
  const statusColor = live ? OG.redLive : open ? OG.brand : OG.chalkMuted;

  const prize =
    show?.prizeAmount != null ? `$${show.prizeAmount.toLocaleString("en-US")}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          position: "relative",
          backgroundColor: OG.ink,
          padding: "72px 76px",
        }}
      >
        {/* Corner glow. Placed by moving the element, not by CSS — satori
            ignores the `at` position in radial-gradient and always centres it.
            See the comment in src/app/opengraph-image.tsx. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -340,
            left: -280,
            width: 980,
            height: 980,
            borderRadius: 490,
            backgroundImage:
              "radial-gradient(circle, rgba(212,175,55,0.34) 0%, rgba(212,175,55,0.10) 34%, rgba(212,175,55,0) 62%)",
          }}
        />

        {/* Eyebrow: brand on the left, show status on the right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 14, height: 14, backgroundColor: OG.brand }} />
            <div
              style={{
                marginLeft: 18,
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: 7,
                color: OG.brand,
              }}
            >
              {SITE.name.toUpperCase()}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 5,
              color: statusColor,
            }}
          >
            {statusLabel}
          </div>
        </div>

        {/* Title block */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: ogTitleSize(title),
              lineHeight: 1,
              letterSpacing: 2,
              color: OG.chalk,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 32,
              lineHeight: 1.3,
              color: OG.chalkBody,
            }}
          >
            {lede}
          </div>
        </div>

        {/* Footer: cadence on the left, prize on the right when confirmed */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingTop: 26,
            borderTop: `1px solid ${OG.line}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 4,
              color: OG.chalkMuted,
            }}
          >
            {(show?.cadence ?? "PERFORM FROM HOME").toUpperCase()}
          </div>

          {prize && (
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  letterSpacing: 4,
                  color: OG.chalkMuted,
                  marginRight: 16,
                }}
              >
                PRIZE
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 58,
                  lineHeight: 1,
                  color: OG.brand,
                }}
              >
                {prize}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: 10,
            backgroundImage: OG_BRAND_BAR,
          }}
        />
      </div>
    ),
    {
      ...size,
      // ImageResponse otherwise sends `immutable, max-age=31536000`, which would
      // freeze a card for a year after an editor renames a show. An hour at the
      // edge with a day of stale-while-revalidate keeps scrapes cheap and edits
      // visible.
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
