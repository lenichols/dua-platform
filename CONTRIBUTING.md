# Contributing to Dua

Thanks for helping. This page covers how to get set up, what a good pull
request looks like, and the agreement you'll be asked to sign.

## Getting set up

Follow [Run it locally](README.md#run-it-locally). You need Node.js 22.9+ and
Docker (or OrbStack) for the local database. Never point a development copy
at a database that holds a real event's data.

Run the tests with the database container up:

```bash
npm run db:up
npm test
```

They create and use their own database, `dua_test`, so your development data
is left alone.

## How the code is laid out

- `src/server/policy.ts` holds the rules for who may see and do what, as plain
  functions.
- Everything else in `src/server/` reads and writes the database, and checks
  those rules first. Pages and server actions call these functions; they
  don't query the database themselves.
- `src/db/schema.ts` is the database. After changing it, run
  `npm run db:generate` and commit the new file under `drizzle/`.

## Before you open a pull request

1. For anything larger than a small fix, open an issue first so we can agree
   on the approach before you spend time on it.
2. Keep each pull request to one change. Smaller ones get reviewed faster.
3. Add or update tests for behaviour you change. Changes to ranking, scoring
   or permissions need tests.
4. Run the checks that CI runs:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

5. Update the README or other docs if setup or behaviour changes.

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

## Contributor license agreement

Dua is licensed under the AGPL-3.0. The project also plans a hosted service,
which needs the freedom to combine Dua with code that isn't public, such as
billing. For that to be possible, every contributor signs the
[contributor license agreement](CLA.md). You keep the copyright to your work;
the agreement gives the project the right to use and relicense it.

A bot asks you to sign by commenting on your first pull request. It takes a
few seconds and you only do it once.

## Reporting bugs and asking for features

Use the issue templates. For security problems, don't open a public issue;
follow [SECURITY.md](SECURITY.md).

## Conduct

Everyone taking part is expected to follow the
[code of conduct](CODE_OF_CONDUCT.md).
