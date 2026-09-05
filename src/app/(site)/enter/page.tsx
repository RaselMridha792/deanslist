import type { Metadata } from "next";
import Link from "next/link";
import { EntryForm, type EntryShowOption } from "@/components/forms/EntryForm";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { getCurrentShow, getShow, getShows } from "@/lib/queries";
import { SITE } from "@/content/site";

export const metadata: Metadata = {
  title: "Enter the contest",
  description:
    "Four short steps. Contact details, your talent, a link to your performance, and consent. Under two minutes.",
};

// Shows and their status are dashboard-managed, so this renders per request.
export const dynamic = "force-dynamic";

/**
 * What happens after the entry lands. Copy is the design's own — it describes
 * the review pipeline rather than the four public "how it works" steps, so it
 * is not the HOW_IT_WORKS list in a different order.
 */
const AFTER_ENTRY = [
  {
    n: "01",
    title: "Review",
    body: "Every entry is watched by the team. Shortlisted performers hear from us by email.",
  },
  {
    n: "02",
    title: "Broadcast",
    body: "Selected performances go live on YouTube and Facebook where the audience votes.",
  },
  {
    n: "03",
    title: "Payout",
    body: "Winners are announced on air and paid the prize pool as locked by the audience.",
  },
] as const;

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show: requested } = await searchParams;

  const [shows, current] = await Promise.all([getShows(), getCurrentShow()]);
  const show = (requested ? await getShow(requested) : null) ?? current;

  /**
   * The select is built from the Shows manager rather than hardcoded, so a new
   * season appears in the funnel the moment the client publishes it. The
   * (open) / (waitlist) suffix is the design's, applied to the show's real
   * status — an entry into a closed show is a waitlist signup, and saying so is
   * the difference between a lead and a complaint.
   */
  const showOptions: EntryShowOption[] = shows.map((s) => ({
    slug: s.slug,
    label: `${s.title} (${s.status === "OPEN" || s.status === "LIVE" ? "open" : "waitlist"})`,
  }));

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-ground">
        <div className="absolute inset-0 -z-10 opacity-[.35]">
          <GrayscaleImage
            src="/media/gallery/cts-09"
            alt=""
            priority
            hover={false}
            sizes="100vw"
            className="h-full w-full"
          />
        </div>
        {/* Weighted left, where the type sits. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink from-20% to-ink/40" />

        <div className="shell grid items-end gap-[clamp(32px,4vw,64px)] pb-[clamp(40px,5vw,72px)] pt-[clamp(56px,7vw,120px)] min-[901px]:grid-cols-[7fr_5fr]">
          <div className="animate-dl-rise">
            <Kicker onDark>Enter the contest</Kicker>
            <h1 className="mt-5 text-hero font-extrabold uppercase text-balance">
              Your name on the list starts here.
            </h1>
          </div>
          <p
            className="max-w-[44ch] animate-dl-rise text-lede opacity-[.85] text-pretty"
            style={{ animationDelay: ".2s" }}
          >
            Four short steps. Contact details, your talent, a link to your performance, and
            consent. Under two minutes.
          </p>
        </div>
      </section>

      <section className="shell grid items-start gap-[clamp(32px,5vw,96px)] py-[clamp(48px,6vw,96px)] min-[901px]:grid-cols-[7fr_5fr]">
        <EntryForm shows={showOptions} defaultShowSlug={show?.slug} />

        <aside
          aria-label="What happens after you enter"
          className="flex flex-col gap-[2px] bg-rule"
        >
          <Reveal>
            <div className="bg-ink p-[clamp(24px,2.5vw,36px)] text-ground">
              <Kicker onDark>Entering</Kicker>
              <p className="mt-5 text-display-sm font-extrabold">{show?.title ?? SITE.name}</p>
              {(show?.cadence || show?.prizeAmount) && (
                <div className="mt-3 flex justify-between gap-4 text-[13px] opacity-80">
                  {show?.cadence && <span>{show.cadence}, live</span>}
                  {show?.prizeAmount != null && (
                    <span>${show.prizeAmount.toLocaleString("en-US")} pool</span>
                  )}
                </div>
              )}
            </div>
          </Reveal>

          {AFTER_ENTRY.map((s, i) => (
            <Reveal key={s.n} index={i + 1}>
              <div className="grid grid-cols-[40px_1fr] gap-3 bg-ground p-[clamp(20px,2vw,28px)]">
                <p className="text-[13px] font-extrabold text-brand">{s.n}</p>
                <div>
                  <p className="mb-[6px] text-[18px] font-extrabold tracking-[-.02em]">
                    {s.title}
                  </p>
                  <p className="text-[14px] leading-[1.5] text-neutral-700">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}

          <Reveal index={4}>
            <div className="bg-ground p-[clamp(20px,2vw,28px)] text-[13px] leading-[1.5] text-neutral-700">
              Questions first?{" "}
              <Link href="/contact" className="text-brand-onLight underline underline-offset-4">
                Talk to the team
              </Link>{" "}
              or read the{" "}
              <Link href="/rules" className="text-brand-onLight underline underline-offset-4">
                rules
              </Link>
              .
            </div>
          </Reveal>
        </aside>
      </section>
    </>
  );
}
