// Shared branch-naming rules for the local hooks and the GitHub workflows.
//
// Dua uses plain, single-app branch names:
//
//   production  protected, deployed to production
//   staging     protected, deployed to staging
//   develop     protected integration branch; feature PRs target this
//   <type>/<ticket>-<slug>   short-lived work branch
//
// There are no `*/develop`, `*/staging`, `*/production` or `qa/init` branches
// in this repository.

export const LONG_LIVED_BRANCHES = ["develop", "staging", "production"];

// Kept only while the repository migrates from its original `main` branch.
export const TRANSITIONAL_BRANCHES = ["main"];

export const TYPES = [
  "feat",
  "feature",
  "fix",
  "chore",
  "docs",
  "ci",
  "perf",
  "refactor",
  "test",
  "security",
  "build",
  "revert",
  "deploy",
  "release",
];

// Automation and maintenance branches that do not follow the ticket shape.
const AUTOMATION_PATTERNS = [
  /^hotfix\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  /^release\/v?\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/,
  /^sync\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/,
  /^dependabot\/[a-z0-9./_-]+$/,
  /^renovate\/[a-z0-9./_-]+$/,
  /^analysis\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
];

const WORK_BRANCH = new RegExp(`^(${TYPES.join("|")})/(?:[0-9]+-)?[a-z0-9]+(?:-[a-z0-9]+)*$`);

/** True for a protected long-lived branch. */
export function isLongLived(branch) {
  return LONG_LIVED_BRANCHES.includes(branch);
}

/** True while `main` is still the repository's migration branch. */
export function isTransitional(branch) {
  return TRANSITIONAL_BRANCHES.includes(branch);
}

/** Validate a branch name. Returns { ok, reason }. */
export function validateBranchName(branch) {
  if (!branch || typeof branch !== "string") {
    return { ok: false, reason: "The branch name is empty." };
  }
  if (isLongLived(branch) || isTransitional(branch)) return { ok: true };
  if (AUTOMATION_PATTERNS.some((pattern) => pattern.test(branch))) {
    return { ok: true };
  }
  if (WORK_BRANCH.test(branch)) return { ok: true };
  return {
    ok: false,
    reason: `"${branch}" does not match the branch convention.`,
  };
}

/** The branch a PR from `branch` should normally target. */
export function baseForBranch(branch) {
  if (branch === "develop") return "staging";
  if (branch === "staging") return "production";
  if (branch.startsWith("hotfix/")) return "production";
  if (branch.startsWith("release/")) return "production";
  return "develop";
}

/** Turn an issue title into the slug part of a branch name. */
export function slugify(text, maxLength = 48) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Human-readable branch examples for error messages. */
export function branchExamples() {
  return [
    "feat/42-team-invites",
    "fix/57-unsubscribe-get",
    "chore/engineering-workflow",
    "hotfix/61-score-lock",
    "release/v0.2.0",
  ].join(", ");
}
