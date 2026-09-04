import { ImageResponse } from "next/og";
import { SITE } from "@/content/site";
import { getWinner } from "@/lib/queries";
import { OG, OG_CONTENT_TYPE, OG_GOLD_BAR, OG_SIZE, ogTitleSize } from "@/lib/seo";

/**
 * Per-winner share card.
 *
 * Typography only, no portrait — and that is the point rather than a shortcut.
 * There is no photograph of the Crown the Sound winner anywhere on the old site;
 * it shows the company logo in the slot where a face should be. Pulling a
 * gallery shot in to fill the frame would publish an unidentified person's
 * likeness under someone else's name, so this card does what `WinnerPortrait`
 * does on the page itself: it treats the absence as a design problem and solves
 * it with scale.
 *
 * No webfont is fetched; satori's bundled face renders on every request without
 * a network round trip.
 */

export const alt = `${SITE.name} — winner`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: { slug: string } }) {
  const winner = await getWinner(params.slug).catch((err: unknown) => {
    console.error("[og:winner] lookup failed:", err);
    return null;
  });

  const name = (winner?.name ?? SITE.name).toUpperCase();
  const showLine = winner?.showTitle ? `${winner.showTitle} winner` : "Winner";

  const prize =
    winner?.prizeAwarded != null ? `$${winner.prizeAwarded.toLocaleString("en-US")}` : null;

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

        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 14, height: 14, backgroundColor: OG.gold }} />
            <div
              style={{
                marginLeft: 18,
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: 7,
                color: OG.gold,
              }}
            >
              PRINCIPAL&apos;S ROLL
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 5,
              color: OG.chalkMuted,
            }}
          >
            {SITE.name.toUpperCase()}
          </div>
        </div>

        {/* Name */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: ogTitleSize(name),
              lineHeight: 1,
              letterSpacing: 2,
              color: OG.chalk,
            }}
          >
            {name}
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
            {showLine}
          </div>
        </div>

        {/* Footer */}
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
            ON THE DEAN&apos;S LIST
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
                WON
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 58,
                  lineHeight: 1,
                  color: OG.gold,
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
            backgroundImage: OG_GOLD_BAR,
          }}
        />
      </div>
    ),
    {
      ...size,
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
