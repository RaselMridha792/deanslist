import type { Config } from "tailwindcss";

/**
 * Red, white and black — the client's brand, taken from their logo.
 *
 * Red is a harder accent to make expensive than gold. What separates a luxury
 * red from a loud one is almost entirely restraint and depth:
 *
 *   red    — the accent, not the surface. Under 10% of any screen. Buttons,
 *            eyebrows, key numbers, active states, the live badge. The old site
 *            fills whole bands with bright red gradient, which is exactly what
 *            makes it read as a template rather than a broadcast brand.
 *   depth  — a single flat #C8102E looks like a warning label. The brand scale
 *            runs from a bright specular through the mark's own red down to a
 *            near-black oxblood, so a fill has somewhere to fall away to.
 *   black  — never #000. Pure black kills depth and flattens the red on top.
 *   white  — full white is for display type only. Body copy steps down the
 *            `chalk` ramp; white paragraphs on near-black glare.
 *
 * `brand.DEFAULT` is #C8102E, sampled from the logo, so the site and the mark
 * agree. The gloss gradient is what the gold metal treatment used to do: a
 * flat fill at button size reads as plastic, a gradient with a specular band
 * reads as lacquer.
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Surface ramp. Every step is a real elevation, not a random shade.
        ink: {
          DEFAULT: "#0A0A0C", // page
          raised: "#101015", // section band
          soft: "#16161C", // card
          high: "#1E1E26", // hover / popover
          line: "#2A2A34", // hairline
          edge: "#3A3A46", // emphasised border
        },

        // Text ramp. Full white is reserved for large display type.
        chalk: {
          DEFAULT: "#FFFFFF",
          body: "rgba(255,255,255,0.72)",
          muted: "rgba(255,255,255,0.50)",
          faint: "rgba(255,255,255,0.34)",
          ghost: "rgba(255,255,255,0.16)",
        },

        /**
         * The brand red. Sampled from the logo mark, with a bright specular
         * above it and an oxblood below, so a gradient has range. A flat fill
         * of the base value at any size above a chip reads as a warning label.
         */
        brand: {
          light: "#FF6B7D", // specular highlight
          soft: "#E8384F",
          DEFAULT: "#C8102E", // the logo's red
          deep: "#8E0B20",
          shadow: "#4A0511", // near-black oxblood
        },

        /** Urgency only: the live badge, the final-hours countdown. */
        live: "#FF2D42",

        /** Kept so `brandred` usages keep resolving during the rename. */
        brandred: {
          DEFAULT: "#C8102E",
          live: "#FF2D42",
        },
      },

      backgroundImage: {
        // A specular band and a fall to oxblood. This is what stops a red
        // button reading as plastic — the same job the gold gradient did.
        "brand-gloss":
          "linear-gradient(150deg, #FF6B7D 0%, #E8384F 22%, #C8102E 46%, #A00C24 68%, #7A0819 100%)",
        "brand-hairline":
          "linear-gradient(90deg, transparent 0%, #C8102E 22%, #FF6B7D 50%, #C8102E 78%, transparent 100%)",
        // Vignette that keeps hero text legible over any video frame.
        "hero-scrim":
          "linear-gradient(180deg, rgba(10,10,12,0.35) 0%, rgba(10,10,12,0.55) 45%, rgba(10,10,12,0.94) 100%)",
        // Same scrim weighted to the right, for a hero whose artwork sits left.
        "hero-scrim-right":
          "linear-gradient(255deg, rgba(10,10,12,0.92) 0%, rgba(10,10,12,0.72) 42%, rgba(10,10,12,0.30) 100%)",
      },

      fontFamily: {
        display: ["var(--font-display)", "Impact", "Haettenschweiler", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },

      fontSize: {
        // Display sizes are fluid: they must not wrap awkwardly at 360px and must
        // still feel broadcast-scale at 1440px.
        "display-xl": ["clamp(3.25rem, 9vw, 8rem)", { lineHeight: "0.9", letterSpacing: "0.01em" }],
        "display-lg": ["clamp(2.5rem, 6vw, 5rem)", { lineHeight: "0.94", letterSpacing: "0.01em" }],
        "display-md": ["clamp(1.875rem, 4vw, 3.25rem)", { lineHeight: "1", letterSpacing: "0.015em" }],
        "display-sm": ["clamp(1.5rem, 2.5vw, 2.25rem)", { lineHeight: "1.05", letterSpacing: "0.02em" }],
        eyebrow: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.28em" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.65" }],
      },

      maxWidth: {
        shell: "1240px",
        prose: "68ch",
      },

      spacing: {
        section: "clamp(4rem, 9vw, 8rem)",
        "section-sm": "clamp(2.5rem, 5vw, 4.5rem)",
      },

      borderRadius: {
        card: "14px",
      },

      transitionTimingFunction: {
        // Reveals. Decisive start, long soft settle — the one that reads cinematic.
        cine: "cubic-bezier(0.16, 1, 0.3, 1)",
        // Interface feedback. Quicker settle so buttons feel responsive.
        crisp: "cubic-bezier(0.25, 1, 0.5, 1)",
        // Symmetric, for things that move both ways.
        swing: "cubic-bezier(0.65, 0, 0.35, 1)",
      },

      transitionDuration: {
        fast: "150ms",
        base: "240ms",
        slow: "420ms",
        cine: "800ms",
      },

      boxShadow: {
        "brand-glow": "0 0 0 1px rgba(200,16,46,0.35), 0 8px 40px -12px rgba(200,16,46,0.45)",
        lift: "0 18px 50px -20px rgba(0,0,0,0.9)",
      },

      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },

      animation: {
        "rise-in": "rise-in 800ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-live": "pulse-live 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
