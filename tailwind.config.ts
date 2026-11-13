import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // The event's accent colour, set in the admin panel.
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          dark: "rgb(var(--accent-dark) / <alpha-value>)",
          deep: "rgb(var(--accent-deep) / <alpha-value>)",
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
        // Headings: Jost, whose round geometric letters match the Dua wordmark.
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        // Everything else: Atkinson Hyperlegible, drawn to be easy to read.
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(6 21 59 / 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
