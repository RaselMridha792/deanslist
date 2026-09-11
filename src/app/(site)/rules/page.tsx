import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { ButtonLink } from "@/components/dl/Button";
import { FormatRounds } from "@/components/show/FormatRounds";
import { SHOWS, SITE } from "@/content/site";

// Reads PageSection at request time, so a rules change published from the
// dashboard is live on the next request rather than at the next deploy.
export const dynamic = "force-dynamic";

/**
 * The contest rules. Two parts.
 *
 * First the format: Drop That Mike round by round, from the rules sheet the
 * client supplied on 2026-09-11 (Drop_That_Mike_updated.pdf). It lives in
 * src/content/site.ts so the show page renders exactly the same rounds.
 *
 * Then the general clauses, lifted from the client's own design file
 * (designs/Rules.dc.html). Nothing here is drafted on their behalf, with one
 * exception: 03.3 described the old draining-pool mechanic, which the rules
 * sheet replaced, so it now points at the rounds instead of contradicting them.
 *
 * A clause changes when the client changes it in the dashboard (PageSection,
 * page "rules"), which overrides this list wholesale. The rounds change in
 * site.ts.
 */
const RULES: { heading: string; clauses: string[] }[] = [
  {
    heading: "Eligibility",
    clauses: [
      "Open to performers worldwide, subject to local law.",
      "Entrants must be 18 or older, or enter with the consent of a parent or guardian.",
      "Employees of Dean's List LTD, judges, hosts and their immediate families may not enter.",
    ],
  },
  {
    heading: "Entry",
    clauses: [
      "One entry per person per challenge, submitted through the official entry form on this site.",
      "Performances must be your own. Cover songs are permitted where the challenge allows.",
      "Video links must be public and remain available through the voting period.",
      "Entries close at the deadline shown on the show page. Late entries are not reviewed.",
    ],
  },
  {
    heading: "Judging and voting",
    clauses: [
      "The team reviews every entry and selects performers for broadcast.",
      "Broadcast rounds are decided by the live audience across YouTube and Facebook.",
      "On Drop That Mike the live audience votes Freeze or Pass during every performance, and the rounds set out at the top of this page decide who stays and what they win.",
      "Decisions announced on air are final.",
    ],
  },
  {
    heading: "Prize terms",
    clauses: [
      "Prizes are paid in US dollars by bank transfer or an agreed equivalent within 30 days of the announcement.",
      "Winners are responsible for any taxes due in their jurisdiction.",
      "Dean's List LTD may substitute a prize of equal value where required.",
    ],
  },
  {
    heading: "Broadcast and content",
    clauses: [
      "By entering you grant Dean's List LTD the right to broadcast, clip and promote your performance across its channels.",
      "You confirm you hold, or have cleared, the rights needed for any material in your performance.",
    ],
  },
  {
    heading: "Conduct and legal",
    clauses: [
      "Offensive, unlawful or unsafe content is disqualified.",
      "Dean's List LTD may amend the schedule or these rules where necessary and will announce changes on this page.",
      "Personal data is handled as described in the privacy policy.",
    ],
  },
];

/**
 * The date of the wording above, not of the deploy. A "last updated" that
 * followed the clock would claim a revision that never happened. Once the
 * client publishes from the dashboard, that row's own updatedAt replaces it.
 */
const LAST_UPDATED = "September 2026";

const ROUNDS = SHOWS.find((s) => s.slug === "drop-that-mike")?.rounds ?? [];

const pad = (n: number) => String(n).padStart(2, "0");

type Section = {
  id: string;
  /** "01" through "06". Drives the anchor, the index and the clause numbers. */
  number: string;
  heading: string;
  clauses: string[];
};

/**
 * Same split as src/lib/queries.ts: an unreachable database is a fault, so it
 * warns and serves the published wording in development and rethrows in
 * production. The fallback is the client's own text either way, so an outage
 * costs the dashboard's edits, never the rules themselves.
 */
async function getDashboardSections() {
  try {
    return await prisma.pageSection.findMany({
      where: { page: "rules", published: true },
      orderBy: { sortOrder: "asc" },
    });
  } catch (err) {
    if (env.NODE_ENV === "production") throw err;
    console.warn(
      `[rules] Database unreachable, serving the published rules: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return [];
  }
}

export const metadata: Metadata = {
  title: "Rules & Eligibility",
  description:
    "How Drop That Mike is played round by round, and the eligibility, entry, judging and prize terms behind every Dean's List challenge.",
};

export default async function RulesPage() {
  const rows = await getDashboardSections();
  const fromDashboard = rows.length > 0;

  const source = fromDashboard
    ? rows.map((row) => ({
        heading: row.heading?.trim() || row.key.replace(/-/g, " "),
        // A blank line in the dashboard body starts a new clause, which is how
        // an editor gets 04.1, 04.2 without typing the numbers.
        clauses: row.body
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
      }))
    : RULES;

  const sections: Section[] = source.map((s, i) => ({
    id: `rule-${pad(i + 1)}`,
    number: pad(i + 1),
    heading: s.heading,
    clauses: s.clauses,
  }));

  const lastUpdated = fromDashboard
    ? rows.reduce<Date | null>(
        (latest, row) =>
          !latest || row.updatedAt > latest ? row.updatedAt : latest,
        null,
      )
    : null;

  return (
    <>
      <section className="bg-ink text-ground">
        <div className="mx-auto grid max-w-shell gap-[clamp(32px,4vw,64px)] px-gutter pb-[clamp(40px,5vw,72px)] pt-[clamp(56px,7vw,120px)] min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[901px]:items-end">
          <div className="animate-dl-rise">
            <Kicker onDark>Rules and eligibility</Kicker>
            <h1 className="mt-5 text-balance text-hero font-extrabold uppercase">
              The official rules.
            </h1>
          </div>
          <p className="max-w-[44ch] animate-dl-rise text-pretty text-lede text-ground/85 [animation-delay:200ms]">
            How Drop That Mike is played, round by round, and the eligibility,
            entry, judging and prize terms behind every Dean&apos;s List
            challenge.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- the format */}
      {ROUNDS.length > 0 && (
        <section id="format" className="shell scroll-mt-[90px] pt-section">
          <div className="grid gap-8 pb-[clamp(24px,3vw,40px)] min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:items-end min-[900px]:gap-[clamp(32px,5vw,96px)]">
            <Reveal>
              <Kicker>Drop That Mike</Kicker>
              <h2 className="mt-5 text-balance text-display-md font-extrabold">
                Freeze it. Or lose it.
              </h2>
            </Reveal>
            <Reveal index={1}>
              <p className="max-w-[52ch] text-pretty text-lede text-neutral-800">
                One mic. One clock. One winner takes the pot. Vote Freeze or
                Pass live during every performance: the audience decides who
                stays. Freeze means keep going; every Pass is a strike against
                you.
              </p>
            </Reveal>
          </div>
          <FormatRounds rounds={ROUNDS} />
        </section>
      )}

      {/* ---------------------------------------------------------- clauses */}
      <section className="mx-auto grid max-w-shell gap-[clamp(32px,5vw,96px)] px-gutter pt-section min-[901px]:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] min-[901px]:items-start">
        {/* Sticky only where the two columns exist. Stacked above the rules on a
            phone, a sticky index would follow the reader down its own content. */}
        <nav
          aria-label="Rules sections"
          className="flex flex-col border-t-2 border-rule min-[901px]:sticky min-[901px]:top-[90px]"
        >
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="grid grid-cols-[40px_1fr] gap-3 border-b border-rule py-[14px] text-[14px] font-semibold transition-colors duration-200 ease-dl hover:text-brand-onLight"
            >
              <span className="text-[12px] font-extrabold text-brand">
                {s.number}
              </span>
              {s.heading}
            </a>
          ))}

          <p className="pt-4 text-[12px] leading-[1.5] text-neutral-600">
            {`Last updated ${
              lastUpdated
                ? lastUpdated.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })
                : LAST_UPDATED
            }.`}
          </p>
          <p className="pb-4 pt-2 text-[12px] leading-[1.5] text-neutral-600">
            Something unclear before you enter?{" "}
            <a
              href={`mailto:${SITE.email}`}
              className="text-brand-onLight underline underline-offset-4"
            >
              {SITE.email}
            </a>
          </p>
        </nav>

        <div className="flex flex-col">
          {sections.map((s, i) => (
            <Reveal key={s.id} index={i}>
              <section
                id={s.id}
                className="scroll-mt-[90px] border-t-2 border-rule py-[clamp(28px,3vw,48px)]"
              >
                <div className="grid grid-cols-[64px_1fr] gap-4">
                  <p className="pt-[6px] text-[14px] font-extrabold text-brand">
                    {s.number}
                  </p>
                  <div>
                    <h2 className="mb-5 text-display-sm font-extrabold">
                      {s.heading}
                    </h2>

                    <ol className="flex list-none flex-col gap-3">
                      {s.clauses.map((clause, j) => (
                        <li
                          key={`${s.number}.${j + 1}`}
                          className="grid grid-cols-[44px_1fr] gap-2 text-[16px] leading-[1.55] text-neutral-800"
                        >
                          <span className="pt-1 text-[12px] tabular-nums text-neutral-500">
                            {`${s.number}.${j + 1}`}
                          </span>
                          <span className="text-pretty">{clause}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </section>
            </Reveal>
          ))}
        </div>
      </section>

      {/* One of the two places red is a full field. The button on it is black. */}
      <section className="mt-section-lg bg-brand text-ground">
        <div className="mx-auto grid max-w-shell gap-[clamp(32px,5vw,96px)] px-gutter py-section min-[901px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[901px]:items-end">
          <Reveal>
            <h2 className="text-display-xl font-extrabold uppercase">
              Your stage awaits.
            </h2>
          </Reveal>
          <Reveal index={1} className="border-t-2 border-ground pt-6">
            <p className="text-pretty text-[clamp(16px,1.2vw,19px)] leading-[1.5] text-ground">
              Entries are open. Four fields and one minute stand between you and
              the Principal&apos;s Roll.
            </p>
            <ButtonLink
              href="/enter"
              size="lg"
              className="mt-6 w-full border-ink bg-ink text-ground hover:border-neutral-900 hover:bg-neutral-900"
            >
              Enter the contest
            </ButtonLink>
          </Reveal>
        </div>
      </section>
    </>
  );
}
