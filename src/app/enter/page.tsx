import type { Metadata } from "next";
import { EntryForm } from "@/components/forms/EntryForm";

export const metadata: Metadata = {
  title: "Enter the Contest",
  description:
    "Submit your entry to The Dean's List. Perform, get voted on, and compete for the cash prize.",
};

export default function EnterPage() {
  return (
    <section className="shell py-20">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Entries open</p>
      <h1 className="mt-3 max-w-2xl font-display text-5xl leading-[1.05] tracking-wide md:text-6xl">
        Enter the Dean&apos;s List
      </h1>
      <p className="mt-4 max-w-xl text-white/60">
        Fill in your details and drop a link to your performance video. Every entry is
        reviewed by our team.
      </p>

      <div className="mt-12 max-w-3xl rounded-2xl border border-ink-line bg-ink-soft p-8">
        <EntryForm />
      </div>
    </section>
  );
}
