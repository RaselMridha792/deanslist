import { ButtonLink } from "@/components/dl/Button";
import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { cn } from "@/lib/cn";
import type { Winner } from "@/lib/queries";

/**
 * Black, two columns, the winner's name at display-lg across two lines.
 *
 * Two facts the design prints are not ours to print.
 *
 * The badge in the design reads "Principal's Roll 2025". The winner row carries
 * no announced date, so the year is rendered only when there is one to render.
 *
 * The design's second fact cell is the challenge song. There is no field for it
 * on Winner, and hardcoding "Happy Birthday" would misreport the next winner the
 * client adds from the dashboard, so the cell carries the show instead.
 *
 * The portrait is the same story, and the fix is stronger than it first looks.
 *
 * site.ts records that the old winner page carries no photograph of the winner
 * at all. The first attempt fell back to the show's key art with alt text that
 * named nobody — but crown-the-sound-4 is a photograph of an identifiable man,
 * and a photograph of a person placed beside a winner's name, at this size, in
 * a section headed "Latest winner", tells every sighted visitor that this is
 * that person. Alt text does not reach them.
 *
 * So the fallback is not a photograph. It is a typographic panel: the winner's
 * initials set large on ink, and a line saying the portrait is to come. It
 * holds the design's cell geometry, reads as deliberate, and cannot misidentify
 * anyone. A real portrait uploaded in the dashboard replaces it.
 */

function WinnerPhoto({ src, alt }: { src: string; alt: string }) {
  // A dashboard upload arrives as an absolute URL. GrayscaleImage derives .avif
  // and .webp siblings from the path, which only holds for the media tree, so
  // anything external is rendered as the single file it actually is.
  if (/^https?:\/\//i.test(src)) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="grayscale-media h-full w-full object-cover transition-transform duration-[1200ms] ease-dl group-hover:scale-[1.04]"
      />
    );
  }
  return <GrayscaleImage src={src} alt={alt} className="h-full w-full" />;
}

export function WinnerSpotlight({ winner }: { winner: Winner | null }) {
  if (!winner) return null;

  const initials = winner.name
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const year = winner.announcedAt ? new Date(winner.announcedAt).getUTCFullYear() : null;
  const nameLines = winner.name.split(/\s+/);

  const facts = [
    winner.prizeAwarded !== null && {
      label: "Prize awarded",
      value: `$${winner.prizeAwarded.toLocaleString("en-US")}`,
      big: true,
    },
    winner.showTitle && { label: "Show", value: winner.showTitle, big: false },
  ].filter(Boolean) as { label: string; value: string; big: boolean }[];

  return (
    <section id="winner" className="mt-section-lg bg-ink text-ground">
      <div className="mx-auto grid max-w-shell min-[901px]:grid-cols-2">
        <Reveal className="group relative min-h-[420px] overflow-hidden border-rule-dark min-[901px]:min-h-[560px] min-[901px]:border-r-2">
          <div className="absolute inset-0">
            {winner.photoUrl ? (
              <WinnerPhoto src={winner.photoUrl} alt={winner.name} />
            ) : (
              /* No photograph exists. See the note at the top of this file:
                 anything figurative here would be read as the winner. */
              <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-ink">
                <span
                  aria-hidden
                  className="font-extrabold leading-none tracking-[-.05em] text-ground/[.08]"
                  style={{ fontSize: "clamp(120px,18vw,260px)" }}
                >
                  {initials}
                </span>
                <span className="text-kicker font-semibold uppercase text-ground/40">
                  Portrait to come
                </span>
              </div>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-ink/[.85] p-[clamp(20px,3vw,40px)]">
            <span className="inline-flex items-center bg-brand px-[14px] py-2 text-kicker font-semibold uppercase text-white">
              Principal&apos;s Roll{year ? ` ${year}` : ""}
            </span>
          </div>
        </Reveal>

        <div className="flex flex-col justify-between gap-12 px-[clamp(20px,4vw,72px)] py-[clamp(40px,6vw,96px)]">
          <Reveal index={1}>
            <Kicker onDark className="mb-5">
              {winner.showTitle ? `02 / Latest winner, ${winner.showTitle}` : "02 / Latest winner"}
            </Kicker>
            <h2 className="m-0 mb-7 text-display-lg font-extrabold">
              {nameLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            {winner.story && (
              <p className="m-0 max-w-[46ch] text-pretty text-[clamp(16px,1.25vw,20px)] leading-[1.5] opacity-80">
                {winner.story}
              </p>
            )}
          </Reveal>

          <Reveal index={2} className="grid grid-cols-2 border-t-2 border-rule-dark">
            {facts.map((f, i) => (
              <div
                key={f.label}
                className={cn(
                  "flex flex-col justify-between gap-4 py-6",
                  i === 0 ? "pr-6" : "pl-6",
                  i < facts.length - 1 && "border-r-2 border-rule-dark",
                )}
              >
                <p className="m-0 text-[10px] uppercase tracking-[.16em] opacity-60">{f.label}</p>
                <p
                  className={cn(
                    "m-0 font-extrabold",
                    f.big
                      ? "text-[clamp(32px,3.2vw,56px)] leading-none tracking-[-.03em]"
                      : "text-[clamp(18px,1.4vw,24px)] leading-[1.1] tracking-[-.02em]",
                  )}
                >
                  {f.value}
                </p>
              </div>
            ))}

            <div className="col-span-2 flex flex-wrap gap-3 pt-2">
              <ButtonLink href={`/winners/${winner.slug}`} className="px-5 py-[14px]">
                Read the story
              </ButtonLink>
              <ButtonLink href="/winners" variant="outline-dark" className="px-5 py-[14px]">
                All past winners
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
