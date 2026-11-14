#!/usr/bin/env node
// Create or update the labels used by issue forms, PR conventions and the
// auto-ticket workflow. Idempotent: safe to run repeatedly.
//
// Usage:
//   npm run labels
//   npm run labels -- --repo lenichols/dua-platform

import { execFileSync } from "node:child_process";

const LABELS = [
  ["type:feat", "0e8a16", "New feature or user-facing capability"],
  ["type:fix", "d73a4a", "Bug fix"],
  ["type:security", "b60205", "Security fix or hardening"],
  ["type:docs", "0075ca", "Documentation only"],
  ["type:test", "5319e7", "Tests and test infrastructure"],
  ["type:ci", "1d76db", "CI/CD, workflows and automation"],
  ["type:chore", "6e7781", "Tooling, dependencies or housekeeping"],
  ["type:refactor", "c2e0c6", "Internal change with no behaviour change"],
  ["type:perf", "fbca04", "Performance improvement"],
  ["type:build", "bfd4f2", "Build system or container image"],
  ["type:style", "c2e0c6", "Formatting or style-only change"],
  ["type:revert", "d73a4a", "Revert of a previous change"],
  ["type:deploy", "0e8a16", "Deployment change"],
  ["type:release", "0e8a16", "Promotion or release work"],

  ["area:frontend", "c5def7", "Pages, components and client-side behaviour"],
  ["area:backend", "bfdadc", "Server actions, database and business rules"],
  ["area:database", "d4c5f9", "Schema, migrations and data"],
  ["area:deployment", "f9d0c4", "Vercel, Docker and environments"],
  ["area:security", "b60205", "Authentication, permissions or data protection"],
  ["area:docs", "0075ca", "README, guides and contributor docs"],

  ["status:needs-triage", "ededed", "Needs a first look from a maintainer"],
  ["status:in-review", "fbca04", "PR open and waiting for review"],
  ["status:in-development", "1d76db", "Merged to develop"],
  ["status:in-qa", "5319e7", "Merged to staging and being verified"],
  ["status:done", "0e8a16", "Merged to production"],

  ["auto-ticket", "ededed", "Created automatically for a pull request with no linked issue"],
  ["linked-ticket", "c5def7", "Pull request linked to an existing issue"],
  ["needs-review", "fbca04", "Ready for a reviewer"],
  ["good first issue", "7057ff", "Good for a first-time contributor"],
  ["help wanted", "008672", "Extra attention is welcome"],
  ["bug", "d73a4a", "Something is not working"],
  ["enhancement", "a2eeef", "New feature or improvement"],
  ["task", "1d76db", "Internal or technical task"],
  ["dependencies", "0366d6", "Dependency update"],
  ["skip-changelog", "ffffff", "No release note is needed"],
];

function run(file, args) {
  return execFileSync(file, args, { encoding: "utf8", stdio: "pipe" }).trim();
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

let repo = option("repo");
if (!repo) {
  try {
    repo = run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  } catch {
    console.error("❌ gh is not available or not authenticated. Run `gh auth login`.");
    process.exit(1);
  }
}

let created = 0;
let updated = 0;
let failed = 0;

for (const [name, color, description] of LABELS) {
  try {
    const exists = (() => {
      try {
        run("gh", ["label", "view", name, "--repo", repo, "--json", "name"]);
        return true;
      } catch {
        return false;
      }
    })();

    run("gh", [
      "label",
      "create",
      name,
      "--repo",
      repo,
      "--color",
      color,
      "--description",
      description,
      "--force",
    ]);
    if (exists) updated += 1;
    else created += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${created} created, ${updated} updated, ${failed} failed — ${repo}`);
if (failed > 0) process.exit(1);
