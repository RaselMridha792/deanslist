import { Reveal } from "@/components/dl/Reveal";
import { NewsletterPosterForm } from "@/components/home/NewsletterPosterForm";

/**
 * The closing poster, and the second and last place red is a full field.
 *
 * This is the highest-value form on the site. The business problem behind the
 * whole rebuild is that a large social audience is rented, not owned; every
 * address captured here is one the client can reach without an algorithm's
 * permission.
 */
export function NewsletterPoster() {
  return (
    <section id="notify" className="bg-brand text-white">
      <div className="mx-auto grid max-w-shell items-end gap-[clamp(32px,5vw,96px)] px-gutter py-section-lg min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Reveal>
          <p className="mb-6 text-kicker font-semibold uppercase opacity-90">
            05 / Never miss a show
          </p>
          <h2 className="m-0 text-display-xl font-extrabold uppercase">
            <span className="block">Your</span>
            <span className="block">stage</span>
            <span className="block">awaits.</span>
          </h2>
        </Reveal>

        <Reveal index={1}>
          <NewsletterPosterForm />
        </Reveal>
      </div>
    </section>
  );
}
