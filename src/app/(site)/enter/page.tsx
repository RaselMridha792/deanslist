import type { Metadata } from "next";
import Link from "next/link";
import { EntryForm } from "@/components/forms/EntryForm";
import { Countdown } from "@/components/ui/Countdown";
import { Badge } from "@/components/ui/Badge";
import { getCurrentShow, getShow } from "@/lib/queries";
import { HOW_IT_WORKS } from "@/content/site";

export const metadata: Metadata = {
  title: "Enter the Contest",
  description:
    "Submit your entry to the Dean's List. Perform from home, get voted on live, and compete for the cash prize.",
};

export const dynamic = "force-dynamic";

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show: requested } = await searchParams;
  const show = requested ? ((await getShow(requested)) ?? (await getCurrentShow())) : await getCurrentShow();

  return (
    <>
      <section className="border-b border-ink-line">
        <div className="shell pb-14 pt-32 md:pt-40">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Entries open</Badge>
            {show?.cadence && <Badge>{show.cadence}</Badge>}
          </div>

          <h1 className="mt-6 max-w-3xl text-display-lg uppercase">Enter the contest</h1>
          <p className="mt-5 max-w-prose text-body-lg leading-relaxed text-chalk-body">
            Fill this in once and drop a link to your performance. No venue, no travel, no
            audition queue — the performance is the whole entry requirement.
          </p>

          {show?.entryDeadline && (
            <div className="mt-10">
              <Countdown target={show.entryDeadline} label="Entries close in" showSeconds />
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="shell grid gap-14 lg:grid-cols-[1fr_20rem] lg:gap-16">
          <div className="rounded-card border border-ink-line bg-ink-soft p-6 sm:p-9">
            <EntryForm showSlug={show?.slug} showTitle={show?.title} />
          </div>

          <aside className="lg:pt-4">
            <p className="eyebrow">What happens next</p>
            <ol className="mt-6 space-y-6">
              {HOW_IT_WORKS.map((s) => (
                <li key={s.step} className="flex gap-4">
                  <span className="font-display text-2xl leading-none text-chalk-ghost">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-chalk">
                      {s.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-chalk-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-10 rounded-card border border-ink-line bg-ink-raised p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-chalk">
                Before you enter
              </p>
              <p className="mt-2 text-sm leading-relaxed text-chalk-muted">
                Check eligibility and the prize terms.
              </p>
              <Link href="/rules" className="btn-quiet mt-4">
                Contest rules →
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
