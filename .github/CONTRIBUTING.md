# Contributing to Dua

Thanks for helping. This page covers setup, the branch and commit conventions,
the pull-request checklist and the agreement you'll be asked to sign.

## Getting set up

Follow [Running Dua locally](../docs/running-locally.md). You need Node.js
22.9+ and Docker (or OrbStack) for the local database. Never point a development
copy at a database that holds a real event's data.

```bash
npm ci
cp .env.local.example .env.local
# fill in ADMIN_PASSWORD and SUBMISSION_EDIT_SECRET
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

`npm ci` installs the Husky hooks. They check the branch name, format and lint
staged files, validate the commit message, and run the type and format checks
before a push.

Run the checks with the database container up:

```bash
npm run verify       # Prettier, ESLint (zero warnings), TypeScript
npm test             # Vitest, uses its own dua_test database
npm run build        # production build
```

`npm run db:up` starts Postgres; the tests create and use `dua_test`, so your
development data is left alone.

## Commands and folders

```bash
npm run dev             # local server
npm run format          # write Prettier formatting
npm run format:check    # verify formatting
npm run lint            # ESLint, zero warnings
npm run typecheck       # tsc --noEmit
npm run test            # tests; needs npm run db:up
npm run test:coverage   # tests with coverage
npm run verify          # format + lint + typecheck
npm run verify:full     # verify + tests
npm run build           # production build
npm run db:generate     # after editing src/db/schema.ts: write a migration
npm run db:migrate      # apply migrations
npm run db:seed         # sample data and logins
npm run test:live       # optional: providers against real services

npm run create-branch   # start a correctly named branch from develop
npm run pr              # open a PR with the template and linked issue
npm run changeset       # add a release note for a user-visible change
npm run labels          # create/update GitHub labels (maintainers)
npm run protect-branches # dry-run branch protection; --apply to apply
```

```text
src/
├── app/         # pages and server actions, one folder per area
├── components/  # shared layout: header, footer, logo, theme toggle
├── db/          # the database schema and connection
├── lib/         # event settings and defaults, ranking, email, validation
└── server/      # all database reads and writes, and who may make them
    └── providers/  # email, file storage and sign-in: one file each
drizzle/         # SQL migrations, generated from src/db/schema.ts
scripts/         # command-line helpers: migrate, seed, admins, imports
test/            # test database setup and fixtures
docs/            # guides, including ENGINEERING_WORKFLOW.md
```

## Branches and commits

Dua uses three long-lived branches:

- `develop` — integration; every feature/fix PR targets this.
- `staging` — QA and release candidate.
- `production` — what runs in production.

Start a short-lived branch from `develop` with a ticket number when you have one:

```bash
npm run create-branch -- --type feat --issue 42 --slug team-invites
# feat/42-team-invites

npm run create-branch -- --type fix --slug unsubscribe-get
# fix/unsubscribe-get
```

Allowed types: `feat`, `feature`, `fix`, `chore`, `docs`, `ci`, `perf`,
`refactor`, `test`, `security`, `build`, `revert`, `deploy`, `release`. Also
allowed: `hotfix/<ticket>-<slug>`, `release/vX.Y.Z`, `sync/...` and Dependabot
branches. Direct work on `develop`, `staging` and `production` is blocked;
open a PR instead.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): short summary

Why the change is needed.

Closes #42
```

Examples: `feat(judge): show rubric anchors`, `fix(unsubscribe): require a
POST`, `ci: add the Docker build check`. Commitlint runs locally and in CI.

See [Engineering workflow](../docs/ENGINEERING_WORKFLOW.md) for the full model,
promotion rules and deployment cycle.

## How the code is laid out

- `src/server/policy.ts` holds the rules for who may see and do what, as plain
  functions.
- Everything else in `src/server/` reads and writes the database, and checks
  those rules first. Pages and server actions call these functions; they
  don't query the database themselves.
- `src/server/providers/` has one file each for email, file storage and judge
  sign-in. Adding a provider means writing one function there. If you add or
  change one, run it against the real service with `npm run test:live` (the
  file under `test/live/` says what to set) and say so in the pull request.
- `src/db/schema.ts` is the database. After changing it, run
  `npm run db:generate` and commit the new file under `drizzle/`.

## Before you open a pull request

1. Open an issue first for anything larger than a small fix, so we can agree on
   the approach before you spend time on it. If you're not sure, use the
   [contributors thread](https://github.com/lenichols/dua-platform/issues/1).
2. Keep each pull request to one change. Smaller ones get reviewed faster.
3. Add or update tests for behaviour you change. Changes to ranking, scoring
   or permissions need tests.
4. Run the checks that CI runs:

   ```bash
   npm run verify
   npm test
   npm run build
   ```

5. Use `npm run pr` (or the PR template) and target `develop`, not `staging` or
   `production`. Promotions are separate PRs.

The PR template asks for a summary, the linked issue, test evidence, deployment
impact and a rollback plan. CI must be green before merge; the required check is
**Quality Gate Conclusion**.

## What to be careful with

- **Personal data.** Registrations and submissions hold names, emails and
  phone numbers. Don't log them, don't put them in test fixtures, and don't
  paste real data into issues. Use `@example.org` addresses in tests.
- **Who can see what.** Judges must never see another judge's scores, and
  viewers must never be able to write. If your change touches `src/server/`
  or a server action, add a test that shows these rules still hold.
- **Ranking.** Results must stay reproducible from a seed. Don't use
  `Math.random()` in anything that affects a ranking.
- **Secrets.** Never commit `.env.local` or any key.
- **Migrations.** Add a generated migration and make it backward compatible;
  production rollbacks must not require editing an applied migration.

## Contributor license agreement

Dua is licensed under the AGPL-3.0. The project also plans a hosted service,
which needs the freedom to combine Dua with code that isn't public, such as
billing. For that to be possible, every contributor signs the
[contributor license agreement](CLA.md). You keep the copyright to your work;
the agreement gives the project the right to use and relicense it.

A bot asks you to sign by commenting on your first pull request. It takes a
few seconds and you only do it once.

## Reporting bugs and asking for features

Use the issue forms. For security problems, don't open a public issue; follow
[SECURITY.md](SECURITY.md) or use the private advisory link in the issue
chooser.

## Conduct

Everyone taking part is expected to follow the
[code of conduct](CODE_OF_CONDUCT.md).
