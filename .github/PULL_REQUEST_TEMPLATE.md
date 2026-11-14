## Summary

<!-- What does this change, and why? Keep it short. -->

Closes #

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `security` — security fix or hardening
- [ ] `docs` — documentation
- [ ] `test` — tests
- [ ] `ci` / `chore` / `build` — tooling or infrastructure
- [ ] `refactor` / `perf` — internal change
- [ ] `deploy` / `release` — promotion or release

## How this was checked

- [ ] `npm run verify` (Prettier, ESLint with zero warnings, TypeScript)
- [ ] `npm test` (needs Postgres: `npm run db:up`)
- [ ] Manual check of the affected flow
- [ ] Screenshots or a short recording for UI changes

## Deployment impact

- [ ] Database migration included (`drizzle/`) and is backward compatible
- [ ] New or changed environment variable / secret (documented in `.env.local.example`)
- [ ] Rollback plan:

## Checklist

- [ ] PR title follows Conventional Commits: `type(scope): summary`
- [ ] This targets `develop` (or a promotion to `staging` / `production`)
- [ ] The linked issue is correct (`Closes #N`); if one exists, no duplicate auto-ticket is created
- [ ] No secrets, participant data or real email addresses in the diff
- [ ] Docs/CHANGELOG updated when behaviour or setup changes
- [ ] Branch is up to date with its base and CI is green
