import {
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
} from "./layout";

/**
 * Results. Sent after a show has aired and the audience vote has been counted.
 *
 * The winner's name is optional on purpose. Results often go out before the
 * client has confirmed the spelling of a name, and the old site already names
 * two different winners for the same season (SITE-AUDIT §7). When
 * `winnerName` is absent this reads as a results announcement pointing at the
 * replay, which is true, rather than naming somebody we are not certain about.
 */
export const results: EmailTemplate = {
  key: "results",
  name: "Results",
  description:
    "Post-show results with the replay link. Names the winner when one is confirmed, and reads correctly when one is not.",
  subject: "The results are in: {{showTitle}}",
  preheader: "The audience has voted. Here is how it finished.",

  html: (ctx) => {
    const name = escapeHtml(ctx.firstName);

    const facts = [
      fact("Show", ctx.showTitle),
      ctx.showDate ? fact("Aired", ctx.showDate) : "",
      ctx.winnerName ? fact("Winner", ctx.winnerName) : "",
      ctx.prizeAmount ? fact("Prize awarded", ctx.prizeAmount) : "",
    ].join("");

    return [
      eyebrow("Results"),
      heading("The audience has voted"),
      paragraph(
        ctx.winnerName
          ? `${name}, ${accent(ctx.showTitle)} is decided. ${escapeHtml(ctx.winnerName)} takes it, voted through by the audience and added to the Principal's Roll.`
          : `${name}, ${accent(ctx.showTitle)} is decided. The audience voted, the pot stopped falling, and we have a winner.`,
      ),
      paragraph(
        "Every round of this was in the audience's hands. Thank you for showing up and voting — that is the whole show.",
      ),
      panel(facts),
      button(ctx.watchLink, "Watch the replay"),
      secondaryLink(ctx.showLink, "See the full results and past winners"),
      divider(),
      subheading("Next time it could be you"),
      paragraph(
        "Entries for the next show open to everyone on this list first. If you have a talent and a phone, that is the whole entry requirement.",
      ),
      secondaryLink(ctx.entryLink, "Enter the next show"),
    ].join("");
  },

  text: (ctx) => [
    ctx.winnerName
      ? `${ctx.firstName}, ${ctx.showTitle} is decided. ${ctx.winnerName} takes it, voted through by the audience and added to the Principal's Roll.`
      : `${ctx.firstName}, ${ctx.showTitle} is decided. The audience voted and we have a winner.`,
    "",
    "Every round of this was in the audience's hands. Thank you for showing up",
    "and voting — that is the whole show.",
    "",
    `Show: ${ctx.showTitle}`,
    ...(ctx.showDate ? [`Aired: ${ctx.showDate}`] : []),
    ...(ctx.winnerName ? [`Winner: ${ctx.winnerName}`] : []),
    ...(ctx.prizeAmount ? [`Prize awarded: ${ctx.prizeAmount}`] : []),
    "",
    `Watch the replay: ${ctx.watchLink}`,
    `Full results and past winners: ${ctx.showLink}`,
    "",
    "NEXT TIME IT COULD BE YOU",
    "Entries for the next show open to everyone on this list first.",
    `Enter the next show: ${ctx.entryLink}`,
  ],
};
