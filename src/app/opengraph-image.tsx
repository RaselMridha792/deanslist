import { ImageResponse } from "next/og";
import { SITE } from "@/content/site";
import { OG, OG_CONTENT_TYPE, OG_BRAND_BAR, OG_SIZE, ogTitleSize } from "@/lib/seo";

/**
 * The default social share card.
 *
 * The old site declares `og:image` as `https://deanslist.live/` — the site root,
 * an HTML document rather than an image — which is the entire reason every share
 * on Facebook, WhatsApp and X renders as a bare link (docs/SITE-AUDIT.md §4).
 * This is the fix, and because it is a file-convention route it cannot silently
 * drift out of existence the way a hand-maintained path can.
 *
 * No font is loaded. Satori ships with a bundled face, and pulling a webfont at
 * request time would put a network round trip — and a failure mode — on a
 * one-core VPS every time a scraper touches the site. The broadcast feel comes
 * from scale, uppercase and letter-spacing instead of from Bebas Neue. That is a
 * deliberate trade: a card that always renders beats a card that renders in the
 * right typeface most of the time.
 *
 * This route supersedes the static `/og.jpg` referenced in src/app/layout.tsx —
 * file-based metadata takes precedence over the config-based `openGraph.images`
 * entry. `/og.jpg` stays on disk and is still what `organizationJsonLd()` points
 * at, so nothing breaks; see the report.
 */

export const alt = `${SITE.name} — global talent competition`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  const title = SITE.name.toUpperCase();

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
        {/*
          A single warm glow out of the top-left corner. Brand lights the card, it
          never fills it — the same budget it gets on the site.

          Three things had to be right here and none of them are obvious:
          a linear gradient across a 1200x630 box lands as a diagonal stripe
          straight through the title; satori ignores the `at` position in
          `radial-gradient` and always centres it, so the glow is placed by
          moving an element rather than by CSS; and the outermost stop is
          transparent BRAND rather than transparent ink, because fading between
          two different hues interpolates through a muddy olive on the way out.
        */}
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
            GLOBAL TALENT COMPETITION
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
              fontSize: 34,
              lineHeight: 1.3,
              color: OG.chalkBody,
            }}
          >
            {SITE.tagline}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 26,
            borderTop: `1px solid ${OG.line}`,
            fontSize: 22,
            letterSpacing: 4,
            color: OG.chalkMuted,
          }}
        >
          <div style={{ display: "flex" }}>PERFORM FROM HOME</div>
          <div style={{ display: "flex" }}>WATCH LIVE ON YOUTUBE &amp; FACEBOOK</div>
        </div>

        {/* The metal edge. Two specular stops, same reasoning as .btn-primary. */}
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
    size,
  );
}
