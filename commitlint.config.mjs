/**
 * Conventional Commits are enforced locally (Husky) and in CI (commitlint).
 *
 * Format:
 *   type(scope)!: short summary
 *
 * Examples:
 *   feat(judge): show the rubric next to the score form
 *   fix(unsubscribe): require a POST before opting out
 *   ci: add the Docker build check
 *   chore(deps): bump drizzle-orm
 */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "security",
        "perf",
        "docs",
        "style",
        "refactor",
        "test",
        "chore",
        "ci",
        "build",
        "revert",
        "deploy",
        "release",
      ],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "scope-case": [2, "always", "lower-case"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 200],
    "footer-max-line-length": [2, "always", 200],
  },
};

export default config;
