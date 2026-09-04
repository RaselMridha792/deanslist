import {
  button,
  escapeHtml,
  eyebrow,
  fact,
  heading,
  panel,
  paragraph,
  secondaryLink,
  urgent,
  type EmailTemplate,
} from "./layout";

/**
 * Entry deadline. The only template that leans on red, because red is reserved
 * for urgency and a closing deadline is the definition of it.
 *
 * This template is about `deadlineDate` — `Show.entryDeadline` — and nothing
 * else. It used to print `showDate` under an "Entries close" label, which is
 * the broadcast date: on a video-entry show entries close days before the show
 * starts, so the email named a closing time that was not the closing time. The
 * schema keeps the two as separate columns for exactly this reason, and so does
 * TemplateContext now.
 *
 * The show date still appears when it is known, but as its own labelled fact.
 * Two dates the reader can tell apart are useful; one date wearing the wrong
 * label is a promise the client has to keep.
 *
 * If no deadline is confirmed the template does not manufacture urgency, and it
 * does not borrow the broadcast date to fill the gap. It falls back to "closing
 * soon", because `Show.entryDeadline` is null on purpose (the old site
 * contradicts itself on dates) and a fake deadline in an email is worse than a
 * vague one.
 */
export const deadline: EmailTemplate = {
  key: "deadline",
  name: "Entry deadline",
  description:
    "Last-call push before entries close. Uses the urgency treatment; falls back to 'closing soon' when no entry deadline is confirmed.",
  // Kept short: a full formatted date pushes this past the ~60 characters an
  // inbox shows, and the deadline is in the first line of the body anyway.
  subject: "Last call: {{showTitle}} entries close soon",
  preheader: "Once entries close, the next chance is a whole season away.",

  html: (ctx) => {
    const name = escapeHtml(ctx.firstName);
    const closes = ctx.deadlineDate;

    const facts = [
      fact("Show", ctx.showTitle),
      fact("Entries close", closes ?? "Soon — this is your last reminder"),
      ctx.showDate ? fact("Show date", ctx.showDate) : "",
      ctx.prizeAmount ? fact("Prize", ctx.prizeAmount) : "",
    ].join("");

    return [
      eyebrow("Closing soon"),
      heading(closes ? "Entries close soon" : "Last call for entries"),
      paragraph(
        closes
          ? `${name}, entries for ${escapeHtml(ctx.showTitle)} close ${urgent(closes)}.`
          : `${name}, entries for ${escapeHtml(ctx.showTitle)} are ${urgent("about to close")}.`,
      ),
      paragraph(
        "If you have been meaning to do it, this is the moment. All it takes is your details and a link to a performance — you do not need a studio, a crew, or anything you do not already have on your phone.",
      ),
      panel(facts, { accentBorder: true }),
      button(ctx.entryLink, "Enter before it closes"),
      secondaryLink(ctx.showLink, "See what you are entering"),
      paragraph(
        "Not entering this time? Stay on the list and we will tell you when the next one opens.",
        { muted: true },
      ),
    ].join("");
  },

  text: (ctx) => [
    ctx.deadlineDate
      ? `${ctx.firstName}, entries for ${ctx.showTitle} close ${ctx.deadlineDate}.`
      : `${ctx.firstName}, entries for ${ctx.showTitle} are about to close.`,
    "",
    "If you have been meaning to do it, this is the moment. All it takes is your",
    "details and a link to a performance — no studio, no crew, nothing you do not",
    "already have on your phone.",
    "",
    `Show: ${ctx.showTitle}`,
    `Entries close: ${ctx.deadlineDate ?? "Soon — this is your last reminder"}`,
    ...(ctx.showDate ? [`Show date: ${ctx.showDate}`] : []),
    ...(ctx.prizeAmount ? [`Prize: ${ctx.prizeAmount}`] : []),
    "",
    `Enter before it closes: ${ctx.entryLink}`,
    `See what you are entering: ${ctx.showLink}`,
    "",
    "Not entering this time? Stay on the list and we will tell you when the next",
    "one opens.",
  ],
};
