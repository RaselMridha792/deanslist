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
  step,
  subheading,
  type EmailTemplate,
} from "./layout";

/**
 * Show announcement — the workhorse. Sent when a new show or season opens.
 *
 * Every fact in it is conditional. If the client has not confirmed a date or a
 * prize pool, the email says so in plain words rather than printing a guess or
 * an empty row. That is the same rule the public site follows, and it matters
 * more here: a wrong date in an email cannot be corrected by editing a page.
 */
export const announcement: EmailTemplate = {
  key: "announcement",
  name: "Show announcement",
  description:
    "Announces a new show or season and drives entries. Adapts when the date or prize is not yet confirmed.",
  subject: "{{showTitle}} is open for entries",
  preheader: "Perform from home. Get voted on live. Take the cash.",

  html: (ctx) => {
    // paragraph() takes assembled HTML, so anything dropped into one must be
    // escaped here. Every other helper escapes its own arguments — do not
    // pre-escape what you hand them or it double-encodes.
    const name = escapeHtml(ctx.firstName);

    const facts = [
      fact("Show", ctx.showTitle),
      ctx.showDate
        ? fact("Date", ctx.showDate)
        : fact("Date", "Announced soon — you will hear it here first"),
      ctx.prizeAmount ? fact("Prize", ctx.prizeAmount) : "",
    ].join("");

    return [
      eyebrow("Announcement"),
      heading(`${ctx.showTitle} is open`),
      paragraph(`${name}, entries are open for ${accent(ctx.showTitle)}.`),
      paragraph(
        "Any talent. Perform from home, on camera, in front of a live audience that votes in real time. No agent, no showcase, no travel.",
      ),
      panel(facts, { accentBorder: true }),
      button(ctx.entryLink, "Enter the contest"),
      secondaryLink(ctx.showLink, `Read the full format for ${ctx.showTitle}`),
      divider(),
      subheading("How it works"),
      step(1, "Enter", "Submit your details and a link to your performance. It takes two minutes."),
      step(2, "Get selected", "The team reviews every entry and emails you if you are through."),
      step(3, "Perform live", "You go out to the audience on YouTube and Facebook."),
      step(4, "Get voted", "The audience decides. The winner takes the cash and a place on the Principal's Roll."),
    ].join("");
  },

  text: (ctx) => [
    `${ctx.firstName}, entries are open for ${ctx.showTitle}.`,
    "",
    "Any talent. Perform from home, on camera, in front of a live audience that",
    "votes in real time. No agent, no showcase, no travel.",
    "",
    `Show: ${ctx.showTitle}`,
    `Date: ${ctx.showDate ?? "Announced soon — you will hear it here first"}`,
    ...(ctx.prizeAmount ? [`Prize: ${ctx.prizeAmount}`] : []),
    "",
    `Enter the contest: ${ctx.entryLink}`,
    `Full format: ${ctx.showLink}`,
    "",
    "HOW IT WORKS",
    "1. Enter — submit your details and a link to your performance.",
    "2. Get selected — the team reviews every entry and emails you if you are through.",
    "3. Perform live — you go out to the audience on YouTube and Facebook.",
    "4. Get voted — the audience decides. The winner takes the cash.",
  ],
};
