#!/usr/bin/env node
// Open a pull request with the Dua template, conventional title and linked
// ticket.
//
// Usage:
//   npm run pr
//   npm run pr -- --base develop --issue 42
//   npm run pr -- --draft --skip-checks
//   npm run pr -- --dry-run
//   npm run pr -- --repo CharaD7/dua-platform --head CharaD7:chore/tooling
//
// Base branch mapping:
//   feat/*, fix/*, chore/* ...  -> develop
//   hotfix/*, release/*         -> production
//   develop                     -> staging   (promotion)
//   staging                     -> production (release)
//
// The script pushes to `fork` when that remote exists, otherwise `origin`, and
// opens the PR against the upstream repository (the parent of a fork).

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baseForBranch } from "./lib/branch-naming.mjs";

const CONVENTIONAL = /^(\w+)(?:\(.+\))?!?: .+/;

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

const has = (name) => process.argv.includes(`--${name}`);

const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch === "HEAD") {
  console.error("❌ Detached HEAD: check out a branch before opening a PR.");
  process.exit(2);
}

const base = option("base") || baseForBranch(branch);
const remote =
  option("remote") || (tryRun("git", ["remote", "get-url", "fork"]) ? "fork" : "origin");

let repoInfo;
try {
  repoInfo = JSON.parse(run("gh", ["repo", "view", "--json", "nameWithOwner,parent"]));
} catch {
  console.error("❌ gh is not available or not authenticated. Run `gh auth login`.");
  process.exit(3);
}

const upstream = repoInfo.parent?.nameWithOwner || repoInfo.nameWithOwner;
const headOwner = repoInfo.parent
  ? repoInfo.nameWithOwner.split("/")[0]
  : tryRun("gh", ["api", "user", "--jq", ".login"]) || "";

function resolveBaseRef(baseBranch) {
  for (const candidate of [`origin/${baseBranch}`, "origin/main", "origin/production", "main"]) {
    if (tryRun("git", ["rev-parse", "--verify", candidate])) return candidate;
  }
  return null;
}

function commitsSince(baseRef) {
  const range = baseRef ? `${baseRef}..HEAD` : "-20";
  let raw = tryRun("git", ["log", "--no-merges", "--format=%s%x1f%b%x1e", range]);
  if (raw == null) {
    raw = tryRun("git", ["log", "--no-merges", "--format=%s%x1f%b%x1e", "-20"]) || "";
  }
  return raw
    .split("\x1e")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [subject, body = ""] = block.split("\x1f");
      return { subject: subject.trim(), body: body.trim() };
    });
}

const baseRef = resolveBaseRef(base);
if (!baseRef) {
  console.error(`❌ Could not find a local origin/${base} (or origin/main) to compare against.`);
  console.error("   Run `git fetch origin --prune` and try again.");
  process.exit(2);
}

const commits = commitsSince(baseRef);
const subjects = commits.map((commit) => commit.subject);
const typeCounts = new Map();
const closes = new Set();

for (const subject of subjects) {
  const match = subject.match(/^(\w+)(?:\(.+\))?!?: /);
  if (match) typeCounts.set(match[1], (typeCounts.get(match[1]) || 0) + 1);
}
for (const commit of commits) {
  for (const match of commit.body.matchAll(
    /\b(?:closes|close|fixes|fix|resolves|resolve)\s+#(\d+)/gi
  )) {
    closes.add(match[1]);
  }
}
if (option("issue")) closes.add(option("issue").replace(/^#/, ""));
const branchTicket = branch.match(/^[a-z]+\/(\d+)-/i);
if (branchTicket) closes.add(branchTicket[1]);

const title =
  option("title") ||
  (subjects[0] && CONVENTIONAL.test(subjects[0]) ? subjects[0] : `chore: ${branch}`);
const summary = subjects[0] || branch;
const typeSummary =
  typeCounts.size > 0
    ? [...typeCounts.entries()].map(([type, count]) => `\`${type}\` ×${count}`).join(", ")
    : "`chore`";

const ticketLine =
  closes.size > 0
    ? [...closes].map((number) => `Closes #${number}`).join("\n")
    : "Relates to: <!-- add the issue number, e.g. Closes #42 -->";

const commitLines =
  subjects.length > 0 ? subjects.map((subject) => `- ${subject}`).join("\n") : "- (no commits yet)";

const body = `## Summary

${summary}

${ticketLine}

## Type of change

Auto-detected from commit subjects: ${typeSummary}

- [ ] \`feat\` — new feature
- [ ] \`fix\` — bug fix
- [ ] \`security\` — security fix
- [ ] \`docs\` — documentation
- [ ] \`test\` — tests
- [ ] \`ci\` / \`chore\` / \`build\` — tooling or infrastructure
- [ ] \`refactor\` / \`perf\` — internal change
- [ ] \`deploy\` / \`release\` — promotion or release

## Commits in this PR

${commitLines}

## How this was checked

- [ ] \`npm run verify\` (Prettier, ESLint zero warnings, TypeScript)
- [ ] \`npm test\` (needs Postgres: \`npm run db:up\`)
- [ ] Manual check of the affected flow
- [ ] Screenshots or a short recording for UI changes

## Deployment impact

- [ ] Database migration included (\`drizzle/\`) and is backward compatible
- [ ] New or changed environment variable / secret (documented in \`.env.local.example\`)
- [ ] Rollback plan: <!-- Vercel instant rollback, revert commit, or forward DB fix -->

## Checklist

- [ ] PR title follows Conventional Commits (\`type(scope): summary\`)
- [ ] The linked issue/ticket is correct
- [ ] No secrets, participant data or real email addresses in the diff
- [ ] Docs/CHANGELOG updated when behaviour or setup changes
- [ ] Branch targets the right base (\`develop\`, or a promotion to \`staging\`/\`production\`)
`;

if (has("dry-run")) {
  console.log(`Title: ${title}\nBase: ${base}\nHead: ${headOwner}:${branch}\nRepo: ${upstream}\n`);
  console.log(body);
  process.exit(0);
}

if (!tryRun("gh", ["api", `repos/${upstream}/branches/${base}`])) {
  console.error(
    `\n❌ "${base}" does not exist on ${upstream}. Create the production/staging/develop\n` +
      "   branches first (see docs/ENGINEERING_WORKFLOW.md), or pass --base main while migrating."
  );
  process.exit(2);
}

if (!has("skip-checks")) {
  console.log("🚦 Running `npm run verify`...");
  const checks = spawnSync("npm", ["run", "verify"], { stdio: "inherit" });
  if (checks.status !== 0) {
    console.error("\n❌ Local checks failed. Fix them, or re-run with --skip-checks.");
    process.exit(1);
  }
}

if (!has("no-push")) {
  console.log(`🚀 Pushing ${branch} to ${remote}...`);
  const pushed = spawnSync("git", ["push", "-u", remote, "HEAD"], { stdio: "inherit" });
  if (pushed.status !== 0) {
    console.error(`❌ Push to ${remote} failed.`);
    process.exit(1);
  }
}

const bodyDir = mkdtempSync(join(tmpdir(), "dua-pr-"));
const bodyFile = join(bodyDir, "body.md");
writeFileSync(bodyFile, body, "utf8");

const args = [
  "pr",
  "create",
  "--repo",
  option("repo") || upstream,
  "--base",
  base,
  "--head",
  `${headOwner}:${branch}`,
  "--title",
  title,
  "--body-file",
  bodyFile,
];
if (has("draft")) args.push("--draft");

console.log(`\n📬 Opening PR ${headOwner}:${branch} -> ${upstream}:${base}...`);
const result = spawnSync("gh", args, { stdio: "inherit" });
if (result.status !== 0) {
  console.error(
    `\n❌ gh could not open the PR. Check that "${base}" exists on ${upstream} and that ` +
      "your fork has the branch (the PR body is in " +
      bodyFile +
      ")."
  );
  process.exit(1);
}
