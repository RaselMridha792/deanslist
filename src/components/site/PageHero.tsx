import { Picture } from "@/components/media/Picture";
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
 * The opener every non-home page shares. One component so eleven pages cannot
 * drift into eleven slightly different heading treatments.
 */
export function PageHero({ eyebrow, title, lede, image, children, className }: Props) {
  return (
    <section
      className={cn("relative isolate overflow-hidden border-b border-ink-line", className)}
    >
      {image && (
        <>
          <div className="absolute inset-0 -z-20 opacity-25">
            <Picture src={image} alt="" priority sizes="100vw" />
          </div>
          <div className="absolute inset-0 -z-10 bg-hero-scrim" />
        </>
      )}

      <div className="shell pb-16 pt-32 md:pb-20 md:pt-40">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-4 max-w-4xl text-display-lg uppercase">{title}</h1>
        {lede && (
          <p className="mt-5 max-w-prose text-body-lg leading-relaxed text-chalk-body">{lede}</p>
        )}
        {children && <div className="mt-9">{children}</div>}
      </div>
    </section>
  );
}
