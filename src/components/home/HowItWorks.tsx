import { SectionHeading } from "@/components/ui/SectionHeading";
import { HOW_IT_WORKS } from "@/content/site";

export function HowItWorks() {
  return (
    <section className="section border-b border-ink-line">
      <div className="shell">
        <SectionHeading
          eyebrow="How it works"
          title="Four steps to the Principal's Roll"
          lede="No travel, no venue, no gatekeeping. The performance is the whole entry requirement."
        />

        <ol className="mt-14 grid gap-px overflow-hidden rounded-card border border-ink-line bg-ink-line sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((s) => (
            <li key={s.step} className="bg-ink-soft p-8">
              <p className="font-display text-5xl leading-none text-metal">{s.step}</p>
              <h3 className="mt-5 text-xl uppercase tracking-wide">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-chalk-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
