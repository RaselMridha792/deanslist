import { Cell, CellGrid } from "@/components/dl/CellGrid";
import { Kicker } from "@/components/dl/Kicker";
import { Reveal } from "@/components/dl/Reveal";
import { cn } from "@/lib/cn";

/**
 * The four steps, taken verbatim from the design file.
 *
 * Deliberately not HOW_IT_WORKS from @/content/site: two of its four bodies are
 * worded differently and step 02 carries an em dash, which the handoff rules
 * out. Nothing here is dashboard-managed, so there is no drift to worry about,
 * only a copy source to pick. The design file is the copy source.
 */
const STEPS = [
  {
    step: "01",
    title: "Enter",
    body: "Send your details and a link to your performance. Every entry is reviewed by the team.",
  },
  {
    step: "02",
    title: "Perform",
    body: "Compete from home. No travel, no venue. The performance is the whole entry requirement.",
  },
  {
    step: "03",
    title: "Get voted",
    body: "The audience decides live across YouTube and Facebook. On Drop That Mike they control the prize pool itself.",
  },
  {
    step: "04",
    title: "Make the list",
    body: "Win the cash prize and take your place on the Principal's Roll of the Dean's List.",
  },
];

export function HowItWorks() {
  return (
    <section id="about" className="mx-auto max-w-shell px-gutter pt-section-lg">
      <div className="grid items-end gap-[clamp(32px,5vw,96px)] border-b-2 border-rule pb-[clamp(32px,4vw,56px)] min-[901px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Reveal>
          <Kicker className="mb-5">01 / What is the Dean&apos;s List</Kicker>
          <h2 className="m-0 text-balance text-display-md font-extrabold">
            A global stage, no gatekeeping.
          </h2>
        </Reveal>

        <Reveal index={1}>
          <p className="m-0 max-w-[52ch] text-pretty text-[clamp(17px,1.35vw,22px)] leading-[1.5] text-neutral-800">
            The Dean&apos;s List is an online talent competition broadcast across YouTube and
            Facebook. Contestants perform from wherever they are, the audience votes live, and
            winners take home a cash prize and a permanent place on the{" "}
            <strong className="font-extrabold">Principal&apos;s Roll</strong>.
          </p>
        </Reveal>
      </div>

      <CellGrid cols={4}>
        {STEPS.map((s, i) => (
          <Cell
            key={s.step}
            index={i}
            className={cn(
              "flex min-h-[300px] flex-col gap-5 px-[clamp(16px,2vw,32px)] py-[clamp(28px,3vw,48px)]",
              i === 0 && "pl-0",
              i === STEPS.length - 1 && "pr-0",
            )}
          >
            <p className="text-[14px] font-extrabold tracking-[.1em] text-brand">{s.step}</p>
            <h3 className="m-0 text-display-sm font-extrabold">{s.title}</h3>
            <p className="mb-0 mt-auto text-pretty text-body text-neutral-700">{s.body}</p>
          </Cell>
        ))}
      </CellGrid>
    </section>
  );
}
