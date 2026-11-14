import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const config = [
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // Apostrophes in copy read fine as written.
      "react/no-unescaped-entities": "off",
      // Two existing effects set state on mount (theme toggle, admin paging).
      // Kept as a warning until they're reworked; new code shouldn't add more.
      "react-hooks/set-state-in-effect": "warn",
      // Allow deliberately unused destructured values such as
      // `const { dropped: _dropped, ...rest } = value`.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"] },
];

export default config;
