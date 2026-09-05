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
