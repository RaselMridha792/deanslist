import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { SITE } from "@/content/site";

export const metadata: Metadata = {
  title: "Thank you",
  description: "We received your submission.",
  robots: { index: false, follow: false },
};

/** Copy varies by where the visitor came from, so the page never says "entry received" to someone who filled in the sponsor form. */
const COPY: Record<string, { title: string; body: string; next: string }> = {
  contestant: {
    title: "Entry received",
    body: "Your entry is with the team. Every submission is reviewed, and if you are selected we will email you with the next steps.",
    next: "While you wait, watch how the show works.",
  },
  fan: {
    title: "You're on the roster",
    body: "You're in the talent pool. It's a standing roster — when a challenge opens that fits what you do, you'll hear from us.",
    next: "See what the shows look like.",
  },
  crew: {
    title: "Application received",
    body: "Thanks for applying to the Dean Team. Production reviews applications between seasons and will be in touch if there is a fit.",
    next: "See what we make.",
  },
  sponsor: {
    title: "Enquiry received",
    body: "Thanks for your interest. We will come back to you with package options and current audience figures.",
    next: "In the meantime, see the shows.",
  },
  general: {
    title: "Message received",
    body: "Thanks for getting in touch. The team reads everything and will reply to you directly.",
    next: "Have a look around while you wait.",
  },
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const copy = COPY[from ?? "general"] ?? COPY.general;

  return (
    <>
      <PageHero eyebrow="Received" title={copy.title} lede={copy.body} />

      <section className="section">
        <div className="shell max-w-3xl">
          <div className="rounded-card border border-ink-line bg-ink-soft p-8 sm:p-10">
            <p className="eyebrow">One more thing</p>
            <h2 className="mt-3 text-2xl uppercase tracking-wide">Do not miss the announcement</h2>
            <p className="mt-3 text-chalk-muted">
              Results and show dates go out by email first. Social platforms decide who sees a post; email does not.
            </p>
            <div className="mt-7">
              <NewsletterForm source="thank-you" />
            </div>
          </div>

          <p className="mt-12 text-chalk-muted">{copy.next}</p>
          <div className="mt-5 flex flex-wrap gap-4">
            <ButtonLink href="/watch" variant="ghost">Watch episodes</ButtonLink>
            <ButtonLink href="/winners" variant="ghost">Past winners</ButtonLink>
          </div>

          <div className="mt-12 flex flex-wrap gap-4">
            <a href={SITE.socials.youtube} target="_blank" rel="noopener noreferrer" className="btn-quiet">
              Subscribe on YouTube →
            </a>
            <a href={SITE.socials.facebook} target="_blank" rel="noopener noreferrer" className="btn-quiet">
              Follow on Facebook →
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
