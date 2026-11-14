#!/usr/bin/env node
// Start a short-lived branch from the integration branch.
//
// Usage:
//   npm run create-branch -- --type feat --issue 42 --slug team-invites
//   npm run create-branch -- --type fix --slug fix-unsubscribe
//   npm run create-branch -- --type chore --issue 12 --slug tooling --base develop
//
// If --slug is omitted and --issue is given, the issue title is used.
// Add --push to push the new branch to `fork` (when configured) or `origin`.

import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { branchExamples, slugify, validateBranchName } from "./lib/branch-naming.mjs";

function run(file, args, opts = {}) {
  return execFileSync(file, args, {
    encoding: "utf8",
    stdio: opts.stdio ?? "pipe",
    ...opts,
  }).trim();
}

function tryRun(file, args, opts = {}) {
  try {
    return run(file, args, opts);
  } catch {
    return null;
  }
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function ask(question, fallback = "") {
  if (!stdin.isTTY) return fallback;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

async function issueTitle(number) {
  if (!number) return "";
  try {
    return run("gh", ["issue", "view", String(number), "--json", "title", "--jq", ".title"]);
  } catch {
    console.warn(`⚠️  Could not read issue #${number} (is gh authenticated?).`);
    return "";
  }
}

const type = (option("type") || (await ask("Type (feat/fix/chore/docs/ci/...): "))).trim();
if (!type) {
  console.error("A branch type is required.");
  console.error(`Examples: ${branchExamples()}`);
  process.exit(1);
}

const issue = (option("issue") || "").replace(/^#/, "").trim();
let slug = (option("slug") || "").trim();
if (!slug && issue) {
  slug = slugify(await issueTitle(issue));
}
if (!slug) {
  slug = slugify(await ask("Short slug (e.g. team-invites): "));
}
if (!slug) {
  console.error("A slug is required, e.g. --slug team-invites.");
  process.exit(1);
}

const branch = `${type}/${issue ? `${issue}-` : ""}${slug}`;
const check = validateBranchName(branch);
if (!check.ok) {
  console.error(`❌ ${check.reason}`);
  console.error(`Examples: ${branchExamples()}`);
  process.exit(1);
}

const dirty = tryRun("git", ["status", "--porcelain"]);
if (dirty) {
  console.error("❌ The working tree has uncommitted changes. Commit or stash them first.");
  process.exit(1);
}

tryRun("git", ["fetch", "origin", "--prune"]);

const requestedBase = option("base");
const base =
  requestedBase ||
  (tryRun("git", ["rev-parse", "--verify", "origin/develop"]) ? "develop" : "main");

if (base === "main") {
  console.warn(
    '⚠️  origin/develop does not exist yet; branching from "main". ' +
      "Create the develop/staging/production branches before the first release."
  );
}

const startPoint = tryRun("git", ["rev-parse", "--verify", `origin/${base}`])
  ? `origin/${base}`
  : base;

try {
  run("git", ["switch", "-c", branch, startPoint], { stdio: "inherit" });
} catch {
  console.error(`❌ Could not create "${branch}" from "${startPoint}".`);
  process.exit(1);
}

if (process.argv.includes("--push")) {
  const remote = tryRun("git", ["remote", "get-url", "fork"]) ? "fork" : "origin";
  try {
    run("git", ["push", "-u", remote, "HEAD"], { stdio: "inherit" });
  } catch {
    console.error(`❌ Could not push to "${remote}". The branch still exists locally.`);
    process.exit(1);
  }
}

console.log(`\n✅ Created ${branch} from ${startPoint}.`);
console.log("\nNext:");
console.log("  npm run verify");
console.log('  git add -p && git commit -m "feat(scope): summary"');
console.log("  npm run pr");
