#!/usr/bin/env node
// Enforce the branch convention locally (pre-commit / pre-push) and in CI.
//
// Usage:
//   node scripts/check-branch-name.mjs               # current branch
//   node scripts/check-branch-name.mjs feat/42-x    # a specific branch
//   node scripts/check-branch-name.mjs --pre-commit
//   node scripts/check-branch-name.mjs --pre-push
//   node scripts/check-branch-name.mjs --ci

import { execFileSync } from "node:child_process";
import {
  branchExamples,
  isLongLived,
  isTransitional,
  validateBranchName,
} from "./lib/branch-naming.mjs";

function currentBranch() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const raw = args[0] || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
const branch = raw || currentBranch();
const result = validateBranchName(branch);

if (!result.ok) {
  console.error(`\n❌ ${result.reason}`);
  console.error(`\nUse one of the long-lived branches (develop, staging, production)`);
  console.error(`or a short-lived branch such as: ${branchExamples()}\n`);
  process.exit(1);
}

if ((isLongLived(branch) || isTransitional(branch)) && process.argv.includes("--ci")) {
  // CI runs on protected branches after merges, which is expected.
  console.log(`✅ Protected branch "${branch}" is valid.`);
  process.exit(0);
}

if (isLongLived(branch) && !process.argv.includes("--ci")) {
  const allowed = process.env.ALLOW_PROTECTED_PUSH === "1";
  if (!allowed && (process.argv.includes("--pre-commit") || process.argv.includes("--pre-push"))) {
    console.error(`\n❌ Direct work on protected branch "${branch}" is not allowed.`);
    console.error("   Create a short-lived branch from develop instead:");
    console.error("     npm run create-branch -- --type feat --issue 42 --slug team-invites");
    console.error("   Emergency exception: ALLOW_PROTECTED_PUSH=1 git push\n");
    process.exit(1);
  }
}

if (isTransitional(branch)) {
  console.warn(`⚠️  "${branch}" is the transitional branch. New work should target develop.`);
}

console.log(`✅ Branch "${branch}" follows the convention.`);
