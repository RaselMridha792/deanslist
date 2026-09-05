import type { Config } from "tailwindcss";

/**
 * Tokens from design_handoff_deanslist/README.md, "Design tokens".
 *
 * A light editorial system, not the dark one this replaces: paper ground,
 * near-black ink, red as the single accent. Three rules carry most of the look
 * and are easy to erode one component at a time, so they are worth stating:
 *
 *   radius 0     everywhere, with no exceptions
 *   rules 2px    dividers and cell separators, never 1px
 *   grayscale    every photograph and every video, filter: grayscale(1)
 *                contrast(1.08). No colorized imagery anywhere.
 *
 * Red is a full field only twice on the site — the ticker and the closing
 * poster CTA. Everywhere else it is a chip, a rule, a button, or a word.
 *
 * The accent is #d40000. The bundled design-system stylesheet ships #ec3013 as
 * its default, but every design file overrides it in its own <style> block, and
 * the handoff says so in as many words: "Red primary is #d40000 (not orange)."
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /** Paper. The page sits on this, not on white. */
        ground: "#f3f2f2",
        /** One step down from ground: cell hover, inset panels, the gallery band. */
        surface: "#eae9e9",
        /** Near-black. Used as a background for dark sections and as body text. */
        ink: "#201e1d",

        brand: {
          DEFAULT: "#d40000",
          hover: "#b80000",
          /** Red that stays legible as text on the light ground. */
          onLight: "#8f0000",
          /** Red that stays legible on ink. Links and hovers in dark sections. */
          onDark: "#ff5a4a",
          bright: "#e60f0f",
          tint: "#ffefee",
          tint2: "#ffd9d6",
        },

        neutral: {
          100: "#f8f4f4",
          200: "#eae7e7",
          300: "#d7d3d3",
          400: "#bab6b6",
          500: "#9b9797",
          600: "#7d7979",
          700: "#605d5d",
          800: "#444141",
          900: "#2d2b2b",
        },

        /** Divider on the light ground, and its counterpart on ink. */
        rule: "rgba(32,30,29,.4)",
        "rule-dark": "rgba(243,242,242,.22)",

        /*
         * The dashboard runs dark, and it has its own vocabulary on purpose.
         *
         * The public site is a light editorial system read in bursts. The admin
         * is a working surface read for an hour at a time, and on a large bright
         * table the same paper ground is glare. So the admin inverts: near-black
         * ground, panels a step up from it, one accent.
         *
         * These are named for their ROLE, not their lightness, and nothing in
         * src/app/admin should reach for `bg-white`, `text-ink` or `text-neutral-*`
         * again. That is what let the two themes tangle the first time: the admin
         * borrowed the public site's tokens, so flipping one flipped both.
         *
         * Red as text is always brand.onDark (#ff5a4a, 5.3:1 here). Plain #d40000
         * is 3:1 on this ground and is only ever a fill behind white.
         */
        admin: {
          /** The page itself. */
          bg: "#171615",
          /** Cards, tables, the filter bar. One step up from the page. */
          panel: "#211f1e",
          /** Inputs, row hover, table headers. One step up again. */
          raised: "#2b2827",
          /** The sidebar. Below the page, so the working area comes forward. */
          sunk: "#0f0e0e",
          /** Body copy. */
          text: "#f3f2f2",
          /** Secondary copy: help text, table cells that are not the subject. */
          muted: "rgba(243,242,242,.72)",
          /** Labels, timestamps, counts. */
          faint: "rgba(243,242,242,.52)",
          /*
           * Input placeholders only, and it is applied once, by .field in
           * globals.css. Do NOT reach for it as a text colour: it is under 4.5:1
           * on every ground here by design, and an earlier pass used it for
           * "Not set", "No country data yet" and a row of timestamps, all of
           * which are content. `faint` is the quietest step text may use.
           * scripts/contrast-audit.mjs catches the mistake if it comes back.
           */
          ghost: "rgba(243,242,242,.56)",
          /*
           * Dividers and cell separators only: table row rules, the line under
           * a section head. 2:1, which is enough to read as a rule and quiet
           * enough not to stripe a long table.
           */
          line: "rgba(243,242,242,.22)",
          /*
           * Anything whose EDGE is the thing you see: card borders, inputs, the
           * table outline. 3.4:1, clearing WCAG 1.4.11. On this ground a panel
           * fill is never more than 1.12:1 against the page, so the border is
           * doing all of the work and cannot be decorative.
           */
          "line-strong": "rgba(243,242,242,.38)",
          /*
           * Status colours, named for the ROLE and not the hue, so a chip keeps
           * its meaning if the hue is ever retuned:
           *
           *   ok    a settled, good state — Finalist, Live, a rising delta
           *   info  a state in motion — Shortlisted, in progress
           *   note  a neutral fact worth marking — Contacted
           *
           * Each is a pair. The DEFAULT is the TEXT value and is the only one
           * that has to carry a reading; all three clear 4.5:1 on both grounds:
           *
           *   ok   #57d9a3   9.27:1 on panel   10.21:1 on bg
           *   info #79c0ff   8.44:1 on panel    9.29:1 on bg
           *   note #c9a9ff   8.29:1 on panel    9.12:1 on bg
           *
           * `tint` is the fill behind that text, and like every fill on this
           * ground it is barely a tint at all — 1.28:1 against the panel. So a
           * status chip is read by its EDGE, the same way .notice is: pair the
           * tint with `border-admin-<role>/60`, which lands at 3.9:1, in the
           * same band as line-strong's 3.4:1.
           *
           * Brand red is deliberately not in this set. Red means "somebody has
           * to look at this" and stays the one pill that fills solid.
           */
          ok: { DEFAULT: "#57d9a3", tint: "rgba(87,217,163,.12)" },
          info: { DEFAULT: "#79c0ff", tint: "rgba(121,192,255,.12)" },
          note: { DEFAULT: "#c9a9ff", tint: "rgba(201,169,255,.12)" },
        },
      },

      fontFamily: {
        // One family for everything. Weight and size carry the hierarchy.
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
        display: ["var(--font-archivo)", "system-ui", "sans-serif"],
      },

      fontSize: {
        // Display type is fluid and tightly tracked. The negative letter-spacing
        // is doing real work here — Archivo 800 at 100px set at 0 looks loose.
        "display-xl": ["clamp(56px,8.5vw,160px)", { lineHeight: ".88", letterSpacing: "-.05em" }],
        "display-lg": ["clamp(48px,6.5vw,120px)", { lineHeight: ".9", letterSpacing: "-.045em" }],
        "display-md": ["clamp(40px,5vw,88px)", { lineHeight: ".95", letterSpacing: "-.04em" }],
        "display-sm": ["clamp(26px,2.4vw,40px)", { lineHeight: "1", letterSpacing: "-.03em" }],
        hero: ["clamp(44px,6.2vw,104px)", { lineHeight: ".92", letterSpacing: "-.04em" }],
        stat: ["clamp(40px,5vw,84px)", { lineHeight: ".9", letterSpacing: "-.04em" }],
        kicker: ["11px", { lineHeight: "1.4", letterSpacing: ".16em" }],
        eyebrow: ["11px", { lineHeight: "1.4", letterSpacing: ".14em" }],
        nav: ["12px", { lineHeight: "1", letterSpacing: ".12em" }],
        btn: ["13px", { lineHeight: "1", letterSpacing: ".06em" }],
        "btn-lg": ["15px", { lineHeight: "1", letterSpacing: ".06em" }],
        body: ["15px", { lineHeight: "1.55" }],
        lede: ["clamp(17px,1.4vw,21px)", { lineHeight: "1.5" }],
      },

      spacing: {
        /*
         * The sticky header's height, as a token rather than as the number 66
         * written into four files.
         *
         * Three things have to agree with it or the page breaks in ways nobody
         * connects back to the header: scroll-padding-top (or an in-page anchor
         * lands underneath it), the mobile menu bar that sticks below it, and
         * the two full-height heroes that subtract it from the viewport. They
         * all read this now, so growing the logo cannot leave a stale offset
         * behind, which is exactly what it would have done before.
         */
        header: "72px",

        // The design's own scale, plus the two fluid values it uses everywhere.
        section: "clamp(56px,7vw,112px)",
        "section-lg": "clamp(64px,8vw,128px)",
        gutter: "clamp(20px,4vw,56px)",
      },

      maxWidth: {
        shell: "1680px",
        form: "520px",
        countdown: "560px",
      },

      borderRadius: {
        // Zero everywhere. Listed explicitly so `rounded` resolves to nothing
        // rather than silently falling back to Tailwind's 0.25rem.
        none: "0",
        DEFAULT: "0",
        sm: "0",
        md: "0",
        lg: "0",
        xl: "0",
        full: "0",
      },

      borderWidth: {
        DEFAULT: "2px",
        1: "1px",
        2: "2px",
      },

      boxShadow: {
        sm: "0 1px 2px rgba(45,43,43,.14)",
        md: "0 3px 10px rgba(45,43,43,.16)",
        lg: "0 12px 32px rgba(45,43,43,.22)",
      },

      transitionTimingFunction: {
        // The one curve the whole design moves on.
        dl: "cubic-bezier(.2,.7,.2,1)",
      },

      keyframes: {
        "dl-rise": {
          from: { opacity: "0", transform: "translateY(40px)" },
          to: { opacity: "1", transform: "none" },
        },
        "dl-marquee": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "dl-pulse": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".25" },
        },
        "dl-wipe": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },

      animation: {
        "dl-rise": "dl-rise 1s cubic-bezier(.2,.7,.2,1) both",
        "dl-marquee": "dl-marquee 28s linear infinite",
        "dl-marquee-slow": "dl-marquee 60s linear infinite",
        "dl-pulse": "dl-pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
