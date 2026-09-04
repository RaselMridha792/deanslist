import Link from "next/link";

type Sponsor = { id: string; name: string; logoUrl: string | null; url: string | null };

/** Hidden entirely when there are no sponsors — an empty logo row reads as failure. */
export function SponsorStrip({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) return null;

  return (
    <section className="border-b border-ink-line py-14">
      <div className="shell">
        <p className="eyebrow text-center">In partnership with</p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-14 gap-y-8">
          {sponsors.map((s) => {
            const logo = s.logoUrl ? (
              <img src={s.logoUrl} alt={s.name} loading="lazy" className="h-9 w-auto opacity-60 transition-opacity duration-base ease-crisp hover:opacity-100" />
            ) : (
              <span className="font-display text-2xl uppercase tracking-wide text-chalk-faint">{s.name}</span>
            );
            return (
              <li key={s.id}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer sponsored">{logo}</a>
                ) : (
                  logo
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-10 text-center">
          <Link href="/sponsors" className="btn-quiet">Become a partner</Link>
        </p>
      </div>
    </section>
  );
}
