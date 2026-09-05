import { GrayscaleImage } from "@/components/dl/GrayscaleMedia";
import { Kicker } from "@/components/dl/Kicker";
import { cn } from "@/lib/cn";

type Props = {
  eyebrow?: string;
  title: string;
  lede?: string;
  /** Path without extension. Sits behind a scrim at low opacity. */
  image?: string | null;
  children?: React.ReactNode;
  className?: string;
};

/**
 * The opener the utility pages share: privacy, terms, unsubscribe.
 *
 * These are not designed pages in the handoff, but they are public and a
 * visitor lands on them straight from an email footer, so they use the same
 * ink band as the /about hero rather than a system of their own. The editorial
 * pages build their heroes inline because each one carries a different layout.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  image,
  children,
  className,
}: Props) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden bg-ink text-ground",
        className,
      )}
    >
      {image && (
        <>
          <div className="absolute inset-0 -z-20 opacity-[.35]">
            <GrayscaleImage
              src={image}
              alt=""
              priority
              hover={false}
              sizes="100vw"
              className="h-full w-full"
            />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink from-20% to-ink/40" />
        </>
      )}

      <div className="shell pb-[clamp(40px,5vw,72px)] pt-[clamp(56px,7vw,120px)]">
        {eyebrow && <Kicker onDark>{eyebrow}</Kicker>}
        <h1 className="mt-5 max-w-[18ch] text-balance text-hero font-extrabold uppercase">
          {title}
        </h1>
        {lede && (
          <p className="mt-5 max-w-[52ch] text-pretty text-lede text-ground/85">
            {lede}
          </p>
        )}
        {children && <div className="mt-9">{children}</div>}
      </div>
    </section>
  );
}
