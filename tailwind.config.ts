import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        crimson: {
          DEFAULT: "#E02D3C",
          dark: "#B01E2B",
          deep: "#7E1119",
        },
        blood: "#E74C3C",
        jade: "#27AE60",
        // Theme-aware tokens — resolved from CSS variables (see globals.css)
        // so the same classes work in both dark and light mode.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          2: "rgb(var(--ink-2) / <alpha-value>)",
          3: "rgb(var(--ink-3) / <alpha-value>)",
          4: "rgb(var(--ink-4) / <alpha-value>)",
          5: "rgb(var(--ink-5) / <alpha-value>)",
        },
        bone: "rgb(var(--bone) / <alpha-value>)",
        dust: "rgb(var(--dust) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        go: {
          DEFAULT: "rgb(var(--go) / <alpha-value>)",
          ink: "rgb(var(--go-ink) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-bebas)", "Impact", "sans-serif"],
        cond: ["var(--font-barlow-cond)", "system-ui", "sans-serif"],
        body: ["var(--font-barlow)", "system-ui", "sans-serif"],
        serif: [
          "var(--font-garamond)",
          "Garamond",
          "Georgia",
          "Times New Roman",
          "Times",
          "serif",
        ],
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,.45)",
        crimson: "0 0 30px rgba(224,45,60,.3)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up .6s cubic-bezier(.16,1,.3,1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
