# Engineering workflow

This is the working agreement for Dua: branches, commits, pull requests,
automation, quality gates and deployment. It is deliberately small enough for a
solo maintainer and strict enough for a team.

## 1. Branch model

Dua uses three long-lived branches and short-lived work branches. There are no
`*/develop`, `*/staging`, `*/production`, `qa/init` or other prefixed branches in
this repository.

```
production   protected · deployed to production · release history
   ▲
   │  promotion PR (staging → production)
   │
staging      protected · deployed to staging · QA and final checks
   ▲
   │  promotion PR (develop → staging)
   │
develop      protected · integration · every feature/fix PR targets this
   ▲
   │  short-lived branch + PR
   │
feat/42-team-invites
fix/57-unsubscribe-get
chore/engineering-workflow
```

| Branch                                                            | Purpose                     | Direct push      | PR base for                        |
| ----------------------------------------------------------------- | --------------------------- | ---------------- | ---------------------------------- |
| `production`                                                      | What runs in production     | No               | —                                  |
| `staging`                                                         | Release candidate and QA    | No               | `develop`, `hotfix/*`, `release/*` |
| `develop`                                                         | Integration and development | No               | `feat/*`, `fix/*`, `chore/*`, …    |
| `feat/<ticket>-<slug>`                                            | New capability              | Yes (own branch) | `develop`                          |
| `fix/<ticket>-<slug>`                                             | Bug fix                     | Yes              | `develop`                          |
| `chore/…`, `docs/…`, `ci/…`, `refactor/…`, `test/…`, `security/…` | Maintenance                 | Yes              | `develop`                          |
| `hotfix/<ticket>-<slug>`                                          | Urgent production fix       | Yes              | `production`, then back-merge      |
| `release/vX.Y.Z`                                                  | Optional release candidate  | Yes              | `production`                       |

Branch names are validated by `scripts/check-branch-name.mjs` locally and by the
**Branch Name** workflow. Canonical examples:

```text
feat/42-team-invites
fix/57-unsubscribe-get
chore/engineering-workflow
hotfix/61-score-lock
release/v0.2.0
```

### Migrating the repository from `main`

The repository currently has only `main`. A maintainer should create the three
long-lived branches once, from `main`:

```bash
git switch main && git pull
git switch -c production && git push -u origin production
git switch -c staging production && git push -u origin staging
git switch -c develop staging && git push -u origin develop
```

Then:

1. Set **production** as the default branch in GitHub → Settings → Branches.
2. Run `npm run protect-branches -- --apply` with a token that can administer
   the repository.
3. Keep `main` only until the first production deploy; then delete it. The CI
   and workflow files accept `main` during the transition so the bootstrap PR is
   still validated.

## 2. Start a change

Every change starts from an issue when one exists. The issue number goes into
the branch name so the PR and ticket are easy to connect.

```bash
git switch develop && git pull
npm run create-branch -- --type feat --issue 42 --slug team-invites
```

If there is no issue yet, omit `--issue`:

```bash
npm run create-branch -- --type fix --slug unsubscribe-get
```

The script fetches the issue title (when `gh` is available), validates the
branch name, branches from `origin/develop`, and optionally pushes with
`--push`.

## 3. Commits

Commits use [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): short summary

Optional body explaining why.

Closes #42
```

| Type                 | Use for                              |
| -------------------- | ------------------------------------ |
| `feat`               | A user-visible capability            |
| `fix`                | A bug fix                            |
| `security`           | A security fix or hardening          |
| `perf`               | Performance                          |
| `refactor`           | Internal change, no behaviour change |
| `test`               | Tests and fixtures                   |
| `docs`               | Documentation                        |
| `ci`                 | Workflows and automation             |
| `build`              | Build system or container image      |
| `chore`              | Tooling, dependencies, housekeeping  |
| `revert`             | Reverting a previous commit          |
| `deploy` / `release` | Promotion or release work            |

Rules enforced by commitlint:

- lower-case type, optional lower-case scope;
- summary in the imperative mood, no trailing full stop;
- header at most 100 characters.

Examples:

```text
feat(judge): show the rubric beside the score form
fix(unsubscribe): require a POST before opting out
ci: add the Docker build check
chore(deps): bump drizzle-orm
```

Husky runs `commitlint` in `.husky/commit-msg`; CI re-checks every commit.

## 4. Local quality gates

```bash
npm run format          # write Prettier formatting
npm run format:check    # verify formatting (CI)
npm run lint            # ESLint, zero warnings
npm run typecheck       # tsc --noEmit
npm run test            # Vitest against Postgres (npm run db:up first)
npm run verify          # format:check + lint + typecheck
npm run verify:full     # verify + test
```

Husky hooks:

| Hook         | Runs                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `pre-commit` | branch-name check, Prettier + ESLint on staged files (`lint-staged`) |
| `commit-msg` | commitlint                                                           |
| `pre-push`   | branch-name check + `npm run verify`                                 |

`git push --no-verify` is not a way around the rules: the **No-Verify Guard**
workflow re-runs commitlint, formatting, lint, typecheck and tests on every
pushed branch. Branch protection requires the aggregate **Quality Gate
Conclusion** check before merging.

## 5. Pull requests

Open a PR with the script so the title, template and ticket stay consistent:

```bash
npm run pr
npm run pr -- --base develop --issue 42
npm run pr -- --draft
```

The script:

1. derives the base (`feat/*` → `develop`, `develop` → `staging`, `staging` →
   `production`, `hotfix/*` → `production`);
2. runs `npm run verify` unless `--skip-checks`;
3. pushes to the `fork` remote when one exists, otherwise `origin`;
4. opens a PR against the upstream repository with the template body and a
   `Closes #N` link when the issue is known.

PR conventions:

- **Title:** same as the commit convention, e.g. `feat(judge): rubric preview`.
- **Size:** one logical change; split refactors from behaviour changes.
- **Description:** summary, linked issue, test evidence, deployment impact and
  rollback plan. The template covers all of it.
- **Reviews:** at least one approval for `develop` and `staging`; two for
  `production`, including a code owner.
- **Merge:** squash merge into `develop`; merge commits are acceptable for
  promotions but keep the history linear where possible.
- **UI changes:** include a screenshot or short recording.
- **Schema changes:** include the generated `drizzle/` migration and note the
  rollback plan.

Promotion PRs:

| From                 | To           | Who / when                                           |
| -------------------- | ------------ | ---------------------------------------------------- |
| `feat/*`, `fix/*`, … | `develop`    | Any contributor, after CI                            |
| `develop`            | `staging`    | Maintainer, when the release candidate is ready      |
| `staging`            | `production` | Maintainer/owner approval, after staging smoke tests |
| `hotfix/*`           | `production` | Owner, then back-merge to `staging` and `develop`    |

The **Release Path** workflow blocks a feature branch from jumping straight to
`staging` or `production`, and blocks a deployment branch from being merged back
into `develop` through a normal PR.

## 6. Auto-ticketing

The **Auto-ticket** workflow uses `pull_request_target` only to read PR
metadata; it never checks out or executes pull-request code.

**Existing tickets win.** Before creating anything, the workflow resolves the
issues the PR is addressing:

1. explicit references in the title or body — `Closes #12`, `Fixes #12`,
   `Resolves #12`, `References #12`, `Related to #12`;
2. the ticket number in the branch name — `feat/42-team-invites` → `#42`;
3. an existing auto-ticket whose body links this PR.

If any of those resolve, the PR is linked to that issue, the PR gets the
`linked-ticket` label, and **no new ticket is created**. Only a PR with no
linked issue gets an auto-ticket `[PR #12] Short summary`, labelled
`auto-ticket`, `status:in-review` and `type:<type>`.

On merge, every linked ticket moves through:

- `develop` → `status:in-development`
- `staging` → `status:in-qa`
- `production` → `status:done` and the issue is closed.

If the PR is closed without merging, the ticket stays open; an auto-created
ticket is labelled `status:needs-triage`.

Always put `Closes #N` in the PR body (and use the issue number in the branch)
when a ticket already exists. Do not open a second ticket for the same work.

Labels are defined in `scripts/setup-labels.mjs` and can be recreated at any
time:

```bash
npm run labels
```

## 7. CI and required checks

`CI` runs on every pull request and on pushes to `develop`, `staging`,
`production` and the transitional `main`:

| Job                         | What it does                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Quality Gate**            | Prettier, ESLint (zero warnings), TypeScript, migration drift, Vitest with coverage, production build |
| **Commit Messages**         | commitlint over the PR's commits                                                                      |
| **Docker Image**            | builds the image, runs Trivy on dependencies/secrets and the image, uploads SARIF                     |
| **Quality Gate Conclusion** | aggregate required check for branch protection                                                        |

Additional workflows:

| Workflow                    | Trigger                        | Purpose                                                       |
| --------------------------- | ------------------------------ | ------------------------------------------------------------- |
| **No-Verify Guard**         | every push                     | re-runs the gate after `--no-verify`                          |
| **Branch Name**             | PR                             | enforces the naming convention                                |
| **Release Path**            | PR                             | enforces `develop → staging → production`                     |
| **Auto-ticket**             | PR lifecycle                   | creates/links and moves the ticket                            |
| **PR Labels**               | PR                             | applies area/type labels from `.github/labeler.yml`           |
| **Dependency Review**       | PR                             | blocks newly introduced high/critical vulnerable dependencies |
| **Security Scan**           | weekly + manual                | Trivy rescans dependencies and the built image for new CVEs   |
| **Docker Build Check**      | PR                             | verifies the container image                                  |
| **Publish Container Image** | `v*` tag                       | publishes to GHCR for self-hosting                            |
| **Deploy**                  | push to `staging`/`production` | waits for CI, optional deploy hook, health smoke test         |

Branch protection (apply with `npm run protect-branches -- --apply`):

| Branch       | Approvals | Code owner | Required check          | Force push |
| ------------ | --------- | ---------- | ----------------------- | ---------- |
| `develop`    | 1         | No         | Quality Gate Conclusion | No         |
| `staging`    | 1         | Yes        | Quality Gate Conclusion | No         |
| `production` | 2         | Yes        | Quality Gate Conclusion | No         |

## 8. Deployment cycle

### Environments

| Branch       | Environment | Vercel                    | Purpose               |
| ------------ | ----------- | ------------------------- | --------------------- |
| Pull request | Preview     | automatic preview URL     | review, screenshots   |
| `develop`    | Development | preview/branch deployment | integration testing   |
| `staging`    | Staging     | `STAGING_URL`             | QA, release candidate |
| `production` | Production  | `PRODUCTION_URL`          | real events           |

Vercel project settings:

- **Production branch:** `production`.
- **Preview branches:** `develop`, `staging` and pull requests.
- Set `STAGING_URL` and `PRODUCTION_URL` as repository variables for the smoke
  test (e.g. `https://staging.example.org`).
- Protect the GitHub **production** environment with required reviewers.
- Optional: set `VERCEL_STAGING_DEPLOY_HOOK_URL` and
  `VERCEL_PRODUCTION_DEPLOY_HOOK_URL` if you disable Vercel's automatic Git
  deployment. Leave them unset when Vercel already deploys on push.

### Release flow

1. Merge the feature PR into `develop`; CI and the development deployment run.
2. Open `develop → staging` when the release candidate is ready.
3. Staging deploys, then verify the health endpoint and the main flows:
   registration, submission, judge sign-in, one score, results.
4. Open `staging → production`; the production environment requires approval.
5. `deploy.yml` waits for CI on the production commit, triggers the optional
   deploy hook, then polls `/api/health` until it is healthy.
6. Tag the release from `production`:

   ```bash
   npm run version-packages
   git commit -am "chore(release): vX.Y.Z"
   git tag vX.Y.Z
   git push origin production --follow-tags
   ```

`vercel.json` runs `scripts/migrate.mjs` before `next build`, which is fine for
a single Vercel deployment. For a multi-instance or Docker deployment, run
migrations as a separate release step (`RUN_MIGRATIONS=false` on the app
container) so the schema change happens once, before new instances start.

### Rollback

| Scenario                   | Action                                                                            |
| -------------------------- | --------------------------------------------------------------------------------- |
| Bad application deploy     | Vercel → Deployments → **Instant Rollback** to the previous production deployment |
| Bad commit on `production` | `git revert <sha>` via a hotfix PR; do not rewrite protected history              |
| Bad migration              | Deploy a forward fix; never edit an applied migration                             |
| Staging failure            | Keep `production` untouched; fix on `develop` and repeat the promotion            |

### Self-hosting with Docker

```bash
docker build -t dua-platform .
docker run --rm -p 3000:3000 --env-file .env.local dua-platform
```

The image runs migrations on start by default, exposes `/api/health`, and runs
as a non-root user. Set `RUN_MIGRATIONS=false` when migrations are a separate
job.

## 9. Versioning and release notes

Dua uses [Changesets](https://github.com/changesets/changesets) for release
notes. Add one for user-visible or operational changes:

```bash
npm run changeset
```

CI, tests, docs-only work and internal refactors do not need a changeset.
`npm run version-packages` writes `CHANGELOG.md` and bumps `package.json` at
release time.

## 10. Security and data

- Report vulnerabilities privately via the issue chooser → **Report a security
  vulnerability**, never in a public issue.
- Never commit `.env.local`, credentials, participant data or real email
  addresses. Use `@example.org` in tests.
- Dependency Review blocks new high/critical vulnerable dependencies.
- Trivy scans the lockfile, installed production dependencies, secrets and the
  built container image on every PR. It fails on HIGH/CRITICAL findings,
  ignores vulnerabilities with no fix, and uploads the image results as SARIF.
- A weekly **Security Scan** re-runs Trivy so newly disclosed CVEs are caught
  in unchanged code.
- `.trivyignore` is for narrow, explained, time-limited exceptions only; never
  use a wildcard to silence a scan.
- Dependabot opens grouped weekly updates for npm, Actions and the Docker base
  image.
- Server actions and pages must keep using `src/server/policy.ts`; see
  [`docs/judging.md`](judging.md).

## 11. Quick reference

```bash
# daily
git switch develop && git pull
npm run create-branch -- --type feat --issue 42 --slug team-invites
npm run verify
git add -p && git commit -m "feat(judge): rubric preview"
npm run pr

# promotion
git switch develop && git pull
npm run pr -- --base staging
git switch staging && git pull
npm run pr -- --base production

# release
npm run version-packages
git commit -am "chore(release): v0.2.0"
git tag v0.2.0 && git push origin production --follow-tags
```

---

[Back to the README](../README.md) · [Contributing](../.github/CONTRIBUTING.md)
