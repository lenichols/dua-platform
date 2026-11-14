#!/usr/bin/env node
// Apply Dua's branch-protection settings with the GitHub CLI.
//
// Dry-run by default. Applying needs a token with admin rights on the repo:
//   GH_TOKEN=... npm run protect-branches -- --apply
//
// Usage:
//   npm run protect-branches                 # print the desired settings
//   npm run protect-branches -- --apply      # apply them
//   npm run protect-branches -- --repo lenichols/dua-platform --apply

import { execFileSync } from "node:child_process";

const REQUIRED_CHECK = "Quality Gate Conclusion";

const POLICIES = {
  develop: {
    approvals: 1,
    codeOwner: false,
    linearHistory: false,
  },
  staging: {
    approvals: 1,
    codeOwner: true,
    linearHistory: false,
  },
  production: {
    approvals: 2,
    codeOwner: true,
    linearHistory: true,
  },
};

function run(file, args, opts = {}) {
  return execFileSync(file, args, { encoding: "utf8", stdio: "pipe", ...opts }).trim();
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function body(policy) {
  return {
    required_status_checks: {
      strict: true,
      contexts: [REQUIRED_CHECK],
    },
    enforce_admins: false,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: policy.codeOwner,
      required_approving_review_count: policy.approvals,
      require_last_push_approval: true,
    },
    restrictions: null,
    required_linear_history: policy.linearHistory,
    allow_force_pushes: false,
    allow_deletions: false,
    required_conversation_resolution: true,
    lock_branch: false,
    allow_fork_syncing: true,
  };
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

const apply = process.argv.includes("--apply");

for (const [branch, policy] of Object.entries(POLICIES)) {
  const payload = body(policy);
  console.log(`\n=== ${branch} ===`);
  console.log(JSON.stringify(payload, null, 2));

  if (!apply) continue;

  try {
    run("gh", ["api", "-X", "PUT", `repos/${repo}/branches/${branch}/protection`, "--input", "-"], {
      input: JSON.stringify(payload),
    });
    console.log(`✅ Applied protection to ${branch}`);
  } catch (error) {
    console.error(
      `❌ Could not protect ${branch}. Does it exist, and does the token have admin rights?\n` +
        (error instanceof Error ? error.message : String(error))
    );
  }
}

if (!apply) {
  console.log(
    "\nDry run only. Re-run with --apply and a token that can administer the repository."
  );
  console.log(
    `The required check is "${REQUIRED_CHECK}" — make sure the CI workflow publishes it.`
  );
}
