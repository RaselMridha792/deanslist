import Link from "next/link";

const stats = [
  { value: "700K+", label: "YouTube subscribers" },
  { value: "$1,000", label: "Cash prize per season" },
  { value: "Weekly", label: "Live episodes" },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-ink-line">
        <div className="shell relative py-28 md:py-36">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Now casting</p>
          <h1 className="mt-4 max-w-3xl font-display text-6xl leading-[0.95] tracking-wide md:text-8xl">
            Perform. Get voted.
            <br />
            Make the list.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
            A global online talent competition streamed live every week. Enter from
            anywhere in the world and compete for the cash prize.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/enter" className="btn-primary">Enter the contest</Link>
            <Link href="/watch" className="btn-ghost">Watch an episode</Link>
          </div>
        </div>
      </section>

      <section className="border-b border-ink-line bg-ink-soft">
        <div className="shell grid gap-8 py-14 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-4xl tracking-wide text-gold">{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-white/50">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell py-24">
        <h2 className="font-display text-4xl tracking-wide">Section blocks go here</h2>
        <p className="mt-3 max-w-xl text-white/60">
          Current show, latest winner, video highlights, gallery, sponsors, and newsletter
          capture will be built into this page from the approved design.
        </p>
      </section>
    </>
  );
}
