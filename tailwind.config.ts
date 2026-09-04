import type { Config } from "tailwindcss";

/**
 * Charcoal + red + gold is an easy combination to make look cheap. What separates
 * "awards broadcast" from "casino template" is restraint, so the rules are encoded
 * here rather than left to taste:
 *
 *   gold  — accent only, target under 5% of any screen. Buttons, eyebrows, key
 *           numbers, active states. Never a large fill, never body copy.
 *   red   — urgency only. Live badge, final-hours countdown, deadline warnings.
 *           Never decorative.
 *   black — never #000. Pure black kills depth and makes the gold look printed on.
 *   white — never #fff for body copy. Full white on near-black glares; text steps
 *           down through the `chalk` ramp instead.
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

        // Gold reads as metal only when it drifts in hue. A flat fill of the base
        // value always looks like mustard — use the `metal` gradients below.
        gold: {
          light: "#F7ECC6", // specular highlight
          soft: "#E8CC72",
          DEFAULT: "#D4AF37",
          deep: "#A88423",
          shadow: "#7A5E14",
        },

        brandred: {
          DEFAULT: "#C8102E", // brand
          live: "#FF2D42", // urgency signal, small areas only
        },
      },

      backgroundImage: {
        // Two specular bands and a hue drift from warm to cool and back. This is
        // what makes it read as metal rather than as the colour yellow.
        "gold-metal":
          "linear-gradient(150deg, #F7ECC6 0%, #D4AF37 26%, #A88423 48%, #F2DFA0 62%, #C9A331 78%, #7A5E14 100%)",
        "gold-hairline":
          "linear-gradient(90deg, transparent 0%, #D4AF37 22%, #F7ECC6 50%, #D4AF37 78%, transparent 100%)",
        // Vignette that keeps hero text legible over any video frame.
        "hero-scrim":
          "linear-gradient(180deg, rgba(10,10,12,0.35) 0%, rgba(10,10,12,0.55) 45%, rgba(10,10,12,0.94) 100%)",
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
        "gold-glow": "0 0 0 1px rgba(212,175,55,0.30), 0 8px 40px -12px rgba(212,175,55,0.35)",
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
