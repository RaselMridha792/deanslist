import { NewsletterForm } from "@/components/forms/NewsletterForm";

export function NewsletterCTA() {
  return (
    <section className="section">
      <div className="shell">
        <div className="relative overflow-hidden rounded-card border border-ink-line bg-ink-soft px-6 py-14 sm:px-12">
          {/* Brand hairline across the top edge only — the accent as a rule, not a fill. */}
          <span className="absolute inset-x-0 top-0 h-px bg-brand-hairline" />

          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Never miss a show</p>
            <h2 className="mt-3 text-display-md uppercase">Get the next date first</h2>
            <p className="mx-auto mt-4 max-w-prose text-chalk-muted">
              Entry deadlines, live show reminders and winner announcements, straight to your
              inbox before they go out anywhere else.
            </p>

            <div className="mt-9 text-left">
              <NewsletterForm source="homepage" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
