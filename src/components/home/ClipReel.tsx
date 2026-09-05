import { GrayscaleClip } from "@/components/dl/GrayscaleMedia";
import { Reveal } from "@/components/dl/Reveal";

/**
 * Nine vertical cells of the client's own footage, in the design's order, and
 * the one place on the site where media is not desaturated.
 *
 * These are the .mov files no browser could decode on the old site, now MP4 +
 * WebM with a poster frame. GrayscaleClip loads the poster first and leaves the
 * file itself to the browser, which is what keeps nine autoplaying loops from
 * being nine simultaneous downloads.
 */
const CLIPS = [
  { src: "/media/hero/mic", label: "Mic" },
  { src: "/media/texture/singer-m", label: "Singer" },
  { src: "/media/texture/deck", label: "Boards" },
  { src: "/media/texture/bass", label: "Bass" },
  { src: "/media/texture/singer-f", label: "Voice" },
  { src: "/media/texture/drums", label: "Drums" },
  { src: "/media/texture/vocals", label: "Vocals" },
  { src: "/media/texture/keys", label: "Keys" },
  { src: "/media/texture/rap", label: "Rap" },
];

export function ClipReel() {
  return (
    <section className="mt-section-lg overflow-hidden border-y-2 border-rule bg-ink text-ground">
      <div className="mx-auto flex max-w-shell flex-wrap justify-between gap-6 px-gutter py-[clamp(20px,2.5vw,32px)] text-kicker font-semibold uppercase text-brand-onDark">
        <span>Who takes the stage</span>
        <span className="text-ground opacity-60">
          Vocals, rap, drums, bass, keys, boards
        </span>
      </div>

      <div className="grid grid-cols-3 gap-[2px] border-t-2 border-rule-dark bg-rule-dark min-[901px]:grid-cols-9">
        {CLIPS.map((clip, i) => (
          <Reveal key={clip.src} index={i}>
            <GrayscaleClip
              src={clip.src}
              label={clip.label}
              // In colour. This strip is the site's evidence that real people
              // perform on it, and desaturated footage reads as archive rather
              // than as this week.
              color
              // The old .75 was tuned for grayscale, where it still left a
              // legible frame. Colour at .75 goes muddy, so the footage plays
              // close to full and the labels take their contrast from the
              // scrim behind them instead.
              className="[&>video]:opacity-95 [&>video]:transition-opacity [&>video]:duration-500 [&:hover>video]:opacity-100"
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
