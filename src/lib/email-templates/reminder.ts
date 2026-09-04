import {
  accent,
  button,
  escapeHtml,
  eyebrow,
  fact,
  heading,
  panel,
  paragraph,
  secondaryLink,
  type EmailTemplate,
} from "./layout";

/**
 * Pre-show reminder. The highest-value email in the system — this is a weekly
 * show, and a reminder that lands a few hours before it starts is what turns a
 * rented social audience into an owned one (PROJECT-BRIEF §2).
 *
 * Deliberately short. A reminder that has to be read twice has failed. One fact
 * block, one button, nothing else competing.
 */
export const reminder: EmailTemplate = {
  key: "reminder",
  name: "Show reminder",
  description:
    "Short pre-show nudge with the watch link. Built for the automated reminder sequence before every episode.",
  subject: "{{showTitle}} is about to start",
  preheader: "Doors are open. Here is where to watch.",

  html: (ctx) => {
    const name = escapeHtml(ctx.firstName);

    const facts = [
      fact("Show", ctx.showTitle),
      ctx.showDate ? fact("Starts", ctx.showDate) : "",
      ctx.prizeAmount ? fact("On the line", ctx.prizeAmount) : "",
    ].join("");

    return [
      eyebrow("Reminder"),
      heading(ctx.showDate ? "Doors are open" : "We are back on"),
      paragraph(
        ctx.showDate
          ? `${name}, ${accent(ctx.showTitle)} starts ${escapeHtml(ctx.showDate)}.`
          : `${name}, ${accent(ctx.showTitle)} is next up.`,
      ),
      paragraph(
        "The audience decides who stays and who goes home, so your vote is the show. Join the stream and bring someone with you.",
      ),
      panel(facts),
      button(ctx.watchLink, "Watch the show"),
      secondaryLink(ctx.entryLink, "Not entered yet? There is still a way in"),
    ].join("");
  },

  text: (ctx) => [
    ctx.showDate
      ? `${ctx.firstName}, ${ctx.showTitle} starts ${ctx.showDate}.`
      : `${ctx.firstName}, ${ctx.showTitle} is next up.`,
    "",
    "The audience decides who stays and who goes home, so your vote is the show.",
    "Join the stream and bring someone with you.",
    "",
    `Show: ${ctx.showTitle}`,
    ...(ctx.showDate ? [`Starts: ${ctx.showDate}`] : []),
    ...(ctx.prizeAmount ? [`On the line: ${ctx.prizeAmount}`] : []),
    "",
    `Watch the show: ${ctx.watchLink}`,
    `Not entered yet? ${ctx.entryLink}`,
  ],
};
