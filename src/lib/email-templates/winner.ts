import {
  PALETTE,
  accent,
  button,
  divider,
  escapeHtml,
  eyebrow,
  fact,
  heading,
  panel,
  paragraph,
  secondaryLink,
  subheading,
  type EmailTemplate,
  type TemplateContext,
} from "./layout";

/**
 * Winner spotlight. Longer and slower than the results email — this one is a
 * story about a person, sent a while after the show, and its job is to make the
 * next season feel worth entering.
 *
 * There is no image in it. Two reasons, and both are load-bearing:
 *
 *   1. The client has no photograph of the first winner anywhere — the site has
 *      the same gap, which is why WinnerPortrait exists. Inventing one is not an
 *      option and a broken <img> is worse than none.
 *   2. Gmail and Outlook block remote images by default until the recipient
 *      clicks "display images". An email whose entire hero is an image renders
 *      as a grey box to most of the list on first open.
 *
 * The monogram plate below is the same answer the site's WinnerPortrait gives:
 * a typographic stand-in that looks deliberate rather than broken.
 */

/** First letter of the winner's name, set in gold on a raised plate. */
function monogram(name: string): string {
  const initial = name.trim().charAt(0).toUpperCase();
  if (!initial) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>
      <td width="76" height="76" align="center" valign="middle" bgcolor="${PALETTE.inkHigh}" style="width:76px;height:76px;background-color:${PALETTE.inkHigh};border:1px solid ${PALETTE.goldDeep};border-radius:999px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:34px;font-weight:700;line-height:76px;color:${PALETTE.gold};">${escapeHtml(initial)}</td>
    </tr></table>`;
}

function whoLine(ctx: TemplateContext): string {
  if (ctx.winnerName && ctx.prizeAmount) {
    return `${accent(ctx.winnerName)} won ${escapeHtml(ctx.prizeAmount)} on ${escapeHtml(ctx.showTitle)}.`;
  }
  if (ctx.winnerName) {
    return `${accent(ctx.winnerName)} won ${escapeHtml(ctx.showTitle)}.`;
  }
  return `Meet the latest name on the Principal's Roll from ${accent(ctx.showTitle)}.`;
}

export const winner: EmailTemplate = {
  key: "winner",
  name: "Winner spotlight",
  description:
    "Profile of a past winner, used between seasons to keep the list warm. Typographic — carries no image, by design.",
  // Phrased so it still reads as a sentence when no winner name is confirmed
  // and {{winnerName}} falls back to "the winner".
  subject: "{{winnerName}} is on the Principal's Roll",
  preheader: "One entry, one performance, one audience vote. Here is how it went.",

  html: (ctx) => {
    const facts = [
      ctx.winnerName ? fact("Winner", ctx.winnerName) : "",
      fact("Show", ctx.showTitle),
      ctx.prizeAmount ? fact("Prize", ctx.prizeAmount) : "",
      ctx.showDate ? fact("Crowned", ctx.showDate) : "",
    ].join("");

    return [
      eyebrow("Principal's Roll"),
      ctx.winnerName ? monogram(ctx.winnerName) : "",
      heading(ctx.winnerName ?? "The Principal's Roll"),
      paragraph(whoLine(ctx)),
      paragraph(
        "No agent. No showcase. No plane ticket. An entry form, a performance filmed at home, and an audience that voted them through round after round.",
      ),
      panel(facts, { accentBorder: true }),
      button(ctx.watchLink, "Watch the performance"),
      secondaryLink(ctx.showLink, "Read the full story"),
      divider(),
      subheading("The list is how you hear first"),
      paragraph(
        `${escapeHtml(ctx.firstName)}, everyone on the Principal's Roll started by filling in one form. Entries for the next show are announced to this list before anywhere else.`,
      ),
      secondaryLink(ctx.entryLink, "Enter the next show"),
    ].join("");
  },

  text: (ctx) => [
    ctx.winnerName && ctx.prizeAmount
      ? `${ctx.winnerName} won ${ctx.prizeAmount} on ${ctx.showTitle}.`
      : ctx.winnerName
        ? `${ctx.winnerName} won ${ctx.showTitle}.`
        : `Meet the latest name on the Principal's Roll from ${ctx.showTitle}.`,
    "",
    "No agent. No showcase. No plane ticket. An entry form, a performance filmed",
    "at home, and an audience that voted them through round after round.",
    "",
    ...(ctx.winnerName ? [`Winner: ${ctx.winnerName}`] : []),
    `Show: ${ctx.showTitle}`,
    ...(ctx.prizeAmount ? [`Prize: ${ctx.prizeAmount}`] : []),
    ...(ctx.showDate ? [`Crowned: ${ctx.showDate}`] : []),
    "",
    `Watch the performance: ${ctx.watchLink}`,
    `Read the full story: ${ctx.showLink}`,
    "",
    "THE LIST IS HOW YOU HEAR FIRST",
    `${ctx.firstName}, everyone on the Principal's Roll started by filling in one`,
    "form. Entries for the next show are announced to this list before anywhere else.",
    `Enter the next show: ${ctx.entryLink}`,
  ],
};
