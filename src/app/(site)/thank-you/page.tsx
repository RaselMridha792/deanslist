import type { Metadata } from "next";

import { ButtonAnchor } from "@/components/dl/Button";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { SITE } from "@/content/site";
import { absoluteUrl } from "@/lib/seo";
import { getCurrentShow, getGallery } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Thank you",
  description: "We received your submission.",
  robots: { index: false, follow: false },
};

// Reads a dashboard-managed show title and gallery image, so it is rendered per
// request rather than baked at build time.
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ copy */

/**
 * Where the visitor came from decides the headline block, so the page never
 * tells someone who joined the standing talent pool that their contest entry
 * was received.
 *
 * `contestant` is the design's copy, verbatim. The design supplies no other
 * state, so the remaining four are written here in its register and flagged for
 * the client to review: same three moves in the same order (confirmation to the
 * inbox, what the team does with it, how you hear back), no contractions, and
 * no claim about a date, a prize, a name or an audience figure. The opening
 * sentence is the design's own, reused rather than rephrased.
 */
const FROM = ["contestant", "fan", "crew", "sponsor", "general"] as const;
type From = (typeof FROM)[number];

const COPY: Record<From, { kicker: string; title: string; lede: string }> = {
  // Design copy, verbatim from Thank You.dc.html.
  contestant: {
    kicker: "Entry received",
    title: "You are in.",
    lede: "A confirmation is on its way to your inbox. The team reviews every entry before the next Tuesday show. If you are shortlisted, you hear from us by email.",
  },
  // Written for review. Reached from the talent pool form on /join, which is a
  // standing roster and not an entry, so it must not borrow the design's line.
  fan: {
    kicker: "Details received",
    title: "You are on the roster.",
    lede: "A confirmation is on its way to your inbox. The talent pool is a standing roster and the team reads every submission. When a challenge opens that fits what you do, you hear from us by email.",
  },
  // Written for review. Reached from the Dean Team application on /join.
  crew: {
    kicker: "Application received",
    title: "Thank you.",
    lede: "A confirmation is on its way to your inbox. The team reads every application. If there is a fit with one of the roles, you hear from us by email.",
  },
  // Written for review. Reached from the inquiry form on /sponsors. It promises
  // reach figures without stating one, because the numbers are the client's to
  // confirm.
  sponsor: {
    kicker: "Inquiry received",
    title: "Thank you.",
    lede: "A confirmation is on its way to your inbox. The team reviews every sponsorship inquiry. You hear from us by email with package options and current reach figures.",
  },
  // Written for review. The fallback for any other route, and for a `from` value
  // this page does not recognise.
  general: {
    kicker: "Message received",
    title: "Thank you.",
    lede: "A confirmation is on its way to your inbox. The team reads everything that comes in. You hear back from us by email.",
  },
};

/** Narrow the query string rather than indexing an object with it. */
function isFrom(v: string | undefined): v is From {
  return typeof v === "string" && (FROM as readonly string[]).includes(v);
}

/** The next-steps column. Copy is the design's, verbatim. */
const NEXT_STEPS = [
  {
    step: "01",
    title: "Follow the channels",
    body: "Show dates and results land on YouTube and Facebook first.",
  },
  {
    step: "02",
    title: "Watch the last show",
    body: "See how Freeze or Pass plays before your turn.",
  },
  {
    step: "03",
    title: "Bring your crowd",
    body: "Votes decide the pool. Share your entry the night you go live.",
  },
] as const;

/* ------------------------------------------------------------------ page */

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ from }, show, gallery] = await Promise.all([
    searchParams,
    getCurrentShow(),
    getGallery(),
  ]);

  const copy = COPY[isFrom(from) ? from : "general"];
  const showTitle = show?.title ?? "Drop That Mike";

  // The design's backdrop is gallery/cts-10. The gallery is dashboard-managed,
  // so it is read from there rather than hardcoded, falling back to whatever the
  // client has ordered first.
  const backdrop = gallery.find((g) => g.url.includes("cts-10")) ?? gallery[0] ?? null;

  const shareHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    absoluteUrl("/"),
  )}`;

  /*
    One section, then the footer. The design file has nothing after this, and a
    confirmation is not the place to open a second ask.
  */
  return (
    <section className="relative isolate flex min-h-[calc(100svh-66px)] items-center overflow-hidden bg-ink text-ground">
      {backdrop && (
        <div className="absolute inset-0 -z-20 opacity-30">
          <GrayscaleImage
            src={backdrop.url}
            alt=""
            priority
            hover={false}
            sizes="100vw"
            className="h-full w-full"
          />
        </div>
      )}
      {/* Solid ink under the copy column, thinning to 40% across the photo. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink from-30% to-ink/40" />

      <div className="shell grid w-full items-end gap-[clamp(32px,4vw,64px)] py-[clamp(56px,7vw,120px)] min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="animate-dl-rise">
          <Kicker onDark>{copy.kicker}</Kicker>
          <h1 className="mt-5 text-balance text-display-lg font-extrabold uppercase">
            {copy.title}
          </h1>
          <p className="mt-7 max-w-[44ch] text-pretty text-lede text-ground/85">{copy.lede}</p>
        </div>

        {/* The 2px rules between cells are the wrapper showing through a gap,
            so the outer edges carry no rule and no cell needs an override. */}
        <div className="flex animate-dl-rise flex-col gap-[2px] bg-rule-dark [animation-delay:.2s]">
          {NEXT_STEPS.map((s) => (
            <div key={s.step} className="grid grid-cols-[36px_1fr] gap-3 bg-ink px-6 py-5">
              <span className="text-[13px] font-extrabold leading-[1.4] text-brand-onDark">
                {s.step}
              </span>
              <div>
                <p className="text-[18px] font-extrabold leading-[1.2] tracking-[-.02em]">
                  {s.title}
                </p>
                <p className="mt-1 text-pretty text-[14px] leading-[1.5] text-ground/75">
                  {s.body}
                </p>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-3 bg-ink px-6 py-5">
            <ButtonAnchor href={SITE.socials.youtube} variant="primary" size="lg">
              Subscribe on YouTube
            </ButtonAnchor>
            <ButtonAnchor href={SITE.socials.facebook} variant="outline-dark" size="lg">
              Follow on Facebook
            </ButtonAnchor>
            <ButtonAnchor href={shareHref} variant="outline-dark" size="lg">
              Share: I entered {showTitle}
            </ButtonAnchor>
          </div>
        </div>
      </div>
    </section>
  );
}
