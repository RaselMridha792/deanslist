import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/dl/Button";
import { Cell, CellGrid } from "@/components/dl/CellGrid";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { CampaignEntryForm } from "@/components/forms/CampaignEntryForm";
import { getPromotion } from "@/lib/promotions";
import { mediaImage } from "@/lib/media";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  jsonLdScriptProps,
  promotionEventJsonLd,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPromotion(slug);
  if (!p) return { title: "Campaign not found" };

  return {
    title: p.title,
    description: p.summary,
    openGraph: {
      title: p.title,
      description: p.summary,
      // The poster IS the share image. It is designed for exactly this, and it
      // beats anything generated: the client's artwork already carries the
      // title, the prize and the branding.
      images: p.imagePath
        ? [{ url: `${mediaImage(p.imagePath)}.jpg` }]
        : undefined,
    },
  };
}

/**
 * A single campaign.
 *
 * Everything on this page comes from the row, so a campaign added in the
 * dashboard on a Tuesday has a full page on the Tuesday. Nothing here names
 * Watch Party Contest or Drop That Mike, and a field the row does not carry is
 * omitted rather than filled with a placeholder — a campaign with no prize
 * simply has no prize band.
 */
export default async function CampaignPage({ params }: Params) {
  const { slug } = await params;
  const promotion = await getPromotion(slug);
  if (!promotion) notFound();

  const ended = promotion.status === "ENDED";

  /*
   * A contest with a named prize and a date is exactly what a search engine
   * renders as a rich result, and these pages carried no structured data at
   * all. Returns null when the campaign has no dates, rather than inventing
   * one to satisfy a validator.
   */
  const jsonLd = jsonLdGraph(
    breadcrumbJsonLd([
      { name: "Campaigns", path: "/campaigns" },
      { name: promotion.title, path: `/campaigns/${promotion.slug}` },
    ]),
    promotionEventJsonLd({
      slug: promotion.slug,
      title: promotion.title,
      summary: promotion.summary,
      prizeTitle: promotion.prizeTitle,
      imagePath: promotion.imagePath
        ? `${mediaImage(promotion.imagePath)}.jpg`
        : null,
      status: promotion.status,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
    }),
  );

  return (
    <>
      {jsonLd && <script {...jsonLdScriptProps(jsonLd)} />}
      {/* ---------------------------------------------------------- hero */}
      <section className="bg-ink text-ground">
        <div className="shell grid gap-[clamp(32px,5vw,80px)] py-[clamp(40px,6vw,88px)] min-[901px]:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] min-[901px]:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={
                  ended
                    ? "border-2 border-rule-dark px-3 py-1.5 text-kicker font-semibold uppercase text-ground/70"
                    : "bg-brand px-3 py-1.5 text-kicker font-semibold uppercase text-white"
                }
              >
                {ended ? "This one has ended" : "Running now"}
              </span>
              {promotion.kicker && <Kicker onDark>{promotion.kicker}</Kicker>}
            </div>

            <h1 className="mt-6 text-balance text-hero font-extrabold uppercase">
              {promotion.title}
            </h1>

            <p className="mt-6 max-w-[52ch] text-pretty text-lede text-ground/85">
              {promotion.summary}
            </p>

            {promotion.showTitle && promotion.showSlug && (
              <p className="mt-6 text-[14px] text-ground/70">
                Runs alongside{" "}
                <Link
                  href={`/shows/${promotion.showSlug}`}
                  className="text-brand-onDark underline underline-offset-4"
                >
                  {promotion.showTitle}
                </Link>
                .
              </p>
            )}

            {/* A campaign taking entries points at its own form. Sending
                somebody to another page from here is asking them to come back. */}
            {!ended && promotion.entry && (
              <div className="mt-9">
                <ButtonLink href="#enter" size="lg">
                  {promotion.entry.buttonLabel}
                </ButtonLink>
              </div>
            )}

            {!ended &&
              !promotion.entry &&
              promotion.ctaLabel &&
              promotion.ctaHref && (
                <div className="mt-9">
                  <ButtonLink href={promotion.ctaHref} size="lg">
                    {promotion.ctaLabel}
                  </ButtonLink>
                </div>
              )}
          </div>

          {promotion.imagePath && (
            <Reveal index={1}>
              {/* The poster in full, not cropped to a band. It is the campaign's
                  own artwork and it carries the rules in it. */}
              <GrayscaleImage
                src={promotion.imagePath}
                alt={`${promotion.title} poster`}
                hover={false}
                color
                sizes="(min-width: 901px) 42vw, 100vw"
                className="w-full"
              />
            </Reveal>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- body */}
      {promotion.body.length > 0 && (
        <section className="shell pt-section">
          <Reveal className="max-w-[62ch]">
            <Kicker>What it is</Kicker>
            <div className="mt-5 flex flex-col gap-5 text-pretty text-lede text-neutral-800">
              {promotion.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* -------------------------------------------------------- steps */}
      {promotion.steps.length > 0 && (
        <section className="shell pt-section">
          <Reveal className="border-b-2 border-rule pb-[clamp(24px,3vw,40px)]">
            <Kicker>How it works</Kicker>
            <h2 className="mt-5 text-balance text-display-md font-extrabold">
              {promotion.steps.length} steps.
            </h2>
          </Reveal>

          <CellGrid
            cols={
              promotion.steps.length >= 4
                ? 4
                : promotion.steps.length >= 3
                  ? 3
                  : 2
            }
            className="border-b-2 border-rule"
          >
            {promotion.steps.map((step, i) => (
              <Cell
                key={step.heading}
                index={i}
                className={`flex min-h-[240px] flex-col gap-[18px] py-[clamp(28px,3vw,48px)] ${
                  i === 0 ? "lg:pl-0" : ""
                }`}
              >
                <p className="text-[14px] font-extrabold tracking-[.1em] text-brand">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="text-[clamp(22px,2vw,32px)] font-extrabold leading-none tracking-[-.03em]">
                  {step.heading}
                </h3>
                {step.body.length > 0 && (
                  <ul className="mt-auto flex flex-col gap-2.5">
                    {step.body.map((line, j) => (
                      <li
                        key={j}
                        className="flex gap-3 text-pretty text-body text-neutral-700"
                      >
                        <span
                          aria-hidden
                          className="mt-[9px] h-1.5 w-1.5 shrink-0 bg-brand"
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Cell>
            ))}
          </CellGrid>
        </section>
      )}

      {/* -------------------------------------------------------- prize */}
      {promotion.prizeTitle && (
        <section className="shell pt-section">
          <Reveal className="border-l-4 border-brand bg-surface p-[clamp(24px,4vw,56px)]">
            <Kicker>The prize</Kicker>
            <p className="mt-5 max-w-[22ch] text-balance text-[clamp(30px,4vw,64px)] font-extrabold uppercase leading-[.95] tracking-[-.04em]">
              {promotion.prizeTitle}
            </p>
            {promotion.prizeNote && (
              <p className="mt-6 max-w-[62ch] text-pretty text-body text-neutral-700">
                {promotion.prizeNote}
              </p>
            )}
          </Reveal>
        </section>
      )}

      {/* -------------------------------------------------------- enter */}
      {promotion.entry && (
        <section id="enter" className="shell pt-section">
          <div className="grid gap-[clamp(28px,4vw,64px)] min-[901px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Reveal>
              <Kicker>Take part</Kicker>
              <h2 className="mt-5 text-balance text-display-md font-extrabold">
                Get your name in.
              </h2>
              <p className="mt-5 max-w-[42ch] text-pretty text-body text-neutral-700">
                Entries are read by the team. You will hear from us by email,
                and the result is announced on the show.
              </p>
            </Reveal>

            <Reveal index={1}>
              <CampaignEntryForm
                config={{
                  promotionSlug: promotion.slug,
                  heading: promotion.entry.heading,
                  blurb: promotion.entry.blurb,
                  buttonLabel: promotion.entry.buttonLabel,
                  askPhone: promotion.entry.askPhone,
                  askCity: promotion.entry.askCity,
                  askGroupSize: promotion.entry.askGroupSize,
                  askLink: promotion.entry.askLink,
                  question: promotion.entry.question,
                }}
              />
            </Reveal>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ closing */}
      <section className="mt-section-lg bg-brand text-ground">
        <div className="shell grid items-end gap-[clamp(32px,5vw,96px)] py-section min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Reveal>
            <h2 className="text-[clamp(40px,7vw,120px)] font-extrabold uppercase leading-[.88] tracking-[-.05em]">
              {promotion.tagline ?? "Your stage awaits."}
            </h2>
          </Reveal>

          <Reveal
            index={1}
            className="flex flex-col gap-6 border-t-2 border-ground pt-6"
          >
            {promotion.hashtags.length > 0 && (
              <p className="flex flex-wrap gap-x-4 gap-y-2 text-kicker font-semibold uppercase text-ground">
                {promotion.hashtags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {!ended && promotion.ctaHref && promotion.ctaLabel && (
                <Link
                  href={promotion.ctaHref}
                  className="btn btn-lg border-ink bg-ink text-ground hover:border-neutral-900 hover:bg-neutral-900"
                >
                  {promotion.ctaLabel}
                </Link>
              )}
              <ButtonLink href="/campaigns" variant="outline-dark" size="lg">
                All campaigns
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

