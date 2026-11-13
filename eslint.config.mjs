import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Apostrophes in copy read fine as written.
      "react/no-unescaped-entities": "off",
      // Two existing effects set state on mount (theme toggle, admin paging).
      // Kept as a warning until they're reworked; new code shouldn't add more.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"] },
];

export default config;
