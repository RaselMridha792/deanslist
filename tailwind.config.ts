import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0B0B0F",
          soft: "#14141B",
          line: "#26262F",
        },
        gold: {
          DEFAULT: "#D4AF37",
          soft: "#E8CC72",
        },
        brandred: "#C8102E",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        shell: "1240px",
      },
    },
  },
  plugins: [],
} satisfies Config;
