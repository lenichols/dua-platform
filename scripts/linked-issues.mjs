#!/usr/bin/env node
// Resolve the existing issue(s) a pull request is addressing.
//
// Priority:
//   1. explicit references in the PR title/body: Closes #12, Fixes #12,
//      Resolves #12, References #12, Related to #12;
//   2. the ticket number in the branch name: feat/42-team-invites → #42;
//   3. an existing auto-ticket whose body links this PR.
//
// Prints a comma-separated list (possibly empty). The auto-ticket workflow
// uses this so an existing ticket is linked instead of creating a duplicate.

import { execFileSync } from "node:child_process";

function run(file, args) {
  return execFileSync(file, args, { encoding: "utf8", stdio: "pipe" }).trim();
}

const repo = process.env.REPO || "";
const prNumber = process.env.PR_NUMBER || "";
const title = process.env.PR_TITLE || "";
const body = process.env.PR_BODY || "";
const head = process.env.HEAD_REF || "";

if (!repo) {
  console.error("REPO is required.");
  process.exit(1);
}

const candidates = new Set();

for (const match of `${title}\n${body}`.matchAll(
  /\b(?:closes?|close|fix(?:es)?|resolves?|references?|refs?|related\s+to)\s+#(\d+)/gi
)) {
  candidates.add(Number.parseInt(match[1], 10));
}

const branchTicket = head.match(/^[a-z]+\/(\d+)-/i);
if (branchTicket) candidates.add(Number.parseInt(branchTicket[1], 10));

if (prNumber) {
  try {
    const issues = JSON.parse(
      run("gh", [
        "issue",
        "list",
        "--repo",
        repo,
        "--label",
        "auto-ticket",
        "--state",
        "all",
        "--limit",
        "500",
        "--json",
        "number,body",
      ])
    );
    const linked = issues.find((issue) =>
      String(issue.body || "").includes(`**Pull Request**: #${prNumber}`)
    );
    if (linked) candidates.add(linked.number);
  } catch {
    // Labels or issues may not exist yet; not fatal.
  }
}

const valid = [];
for (const number of [...candidates].sort((a, b) => a - b)) {
  if (!Number.isSafeInteger(number) || number <= 0) continue;
  try {
    const issue = JSON.parse(run("gh", ["api", `repos/${repo}/issues/${number}`]));
    // An issue number can also point at a pull request; that is not a ticket.
    if (issue?.pull_request) continue;
    valid.push(number);
  } catch {
    // Deleted or inaccessible issue: ignore it.
  }
}

process.stdout.write(valid.join(","));
