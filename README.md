<p align="center">
  <img src="public/dua-logo.svg" alt="Dua" width="320">
</p>

# Dua

Dua is an open source platform for running a hackathon from first sign-up to
final results: registration, mentor sign-up, project submission, judging and a
leaderboard, in one app you host yourself.

What sets it apart is the judging. Every score needs a sentence of evidence,
scores are normalized per judge so a harsh judge and a generous one carry the
same weight, judges can recuse themselves, and the final ranking can be
reproduced from a logged seed.

All it needs is Node.js and a Postgres database.

> **Status: early.** Dua runs today and ships with a made-up sample event, the
> Open Build Hackathon. Expect the database schema to change before 1.0; the
> [roadmap](#roadmap) covers what's coming.

## What you get

| Area | Route | Who | What it does |
| --- | --- | --- | --- |
| Home page | `/` | Public | Landing page whose main button follows the event phase: Register, then Judge Sign In, then View the Winners. |
| Registration | `/register` | Public | Participant sign-up. Opened and closed by an admin switch. |
| Mentor sign-up | `/mentor` | Public | Volunteer mentor sign-up, on the same switch as registration. |
| Submission | `/submit` | Public | Project submission form with a private edit link emailed to the team. Opened and closed by its own admin switch. |
| Judging | `/judge` | Judges, mentors | Sign in, then score each project 1–5 on five weighted criteria with one sentence of evidence each. Judges can declare a conflict to recuse themselves. Mentors can read but not score. |
| Results | `/results` | Judges, mentors, admins | Averages only, never one judge's scores, plus the final ranking. Visible once the phase is `results`. |
| Admin | `/admin` | Organizers | Phase control, registrations with CSV export, judges, submissions, results, email campaigns, and admin accounts with roles. |

The event moves through three phases, switched by an admin:
**submissions → judging → results**.

### Admin roles

| Role | Can do |
| --- | --- |
| Owner | Everything, including creating and removing admin accounts. |
| Admin | Run the event: phases, judges, submissions, results. Can't manage admin accounts. |
| Viewer | Read-only. Can watch progress and export CSVs. The server refuses writes even if a request is forged. |

Roles are read from the database on every request, so removing someone takes
effect immediately. Passwords are stored as scrypt hashes, and repeated failed
sign-ins are locked out for 15 minutes.

## Run it locally

This takes about five minutes and ends with the sample event running on your
machine.

### What you need

- [Node.js](https://nodejs.org) 22.9 or newer. Check with `node --version`.
- A way to run containers: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  or [OrbStack](https://orbstack.dev). Open it before you start.

No Docker? Use a hosted database instead; see
[Database options](#database-options).

### First time

```bash
git clone <this repository's URL>
cd dua-platform
npm install
cp .env.local.example .env.local
```

Open `.env.local` in an editor and fill in two lines:

- `ADMIN_PASSWORD`: make one up. You'll use it to sign in to the admin panel.
- `SUBMISSION_EDIT_SECRET`: 32 or more random characters. Running
  `openssl rand -hex 32` prints a suitable value.

Leave the other lines as they are. Then:

```bash
npm run db:up        # start the database
npm run db:migrate   # create the tables
npm run db:seed      # add five sample projects, a test judge and a test mentor
npm run dev          # start the site
```

`db:seed` prints two passwords. Keep them: they're shown only once.

Open <http://localhost:3000>.

### What to look at

| To see | Go to | Sign in with |
| --- | --- | --- |
| The public site | <http://localhost:3000> | Nothing |
| A judge's view | <http://localhost:3000/judge> | `demo.judge@example.org` and the judge password `db:seed` printed |
| A mentor's view | <http://localhost:3000/judge> | `demo.mentor@example.org` and the mentor password |
| The admin panel | <http://localhost:3000/admin> | Leave the email blank and enter your `ADMIN_PASSWORD` |

Seeding puts the event in the **judging** phase so the test judge can score,
which means the registration and submission forms show as closed. To see them
open: in the admin panel's **Home** tab, switch the phase to **submissions**,
then press **Open registration** and **Open submissions**.

### Stopping and coming back

- Stop the site with `Ctrl+C` in the terminal running `npm run dev`.
- Stop the database with `docker compose stop`. Your data is kept.
- Next time, run `npm run db:up` and then `npm run dev`. Nothing else.
- After pulling new code, also run `npm install` and `npm run db:migrate`.

### If something goes wrong

| What you see | What to do |
| --- | --- |
| `Cannot connect to the Docker daemon` | Open Docker Desktop or OrbStack, wait until it's running, and try again. |
| `DATABASE_URL is not set` | You haven't created `.env.local`. Run `cp .env.local.example .env.local`. |
| `No event "default" in the database` | Run `npm run db:migrate`. |
| `connect ECONNREFUSED` on port 54329 | The database isn't running. Run `npm run db:up`. |
| `Port 3000 is in use` | Something else is using it. Run `npm run dev -- -p 3001` and open port 3001 instead. |
| Lost the test passwords | Run `npm run db:seed` again. It replaces the samples and prints new ones. |
| `Too many failed attempts` at sign-in | Wait 15 minutes, or restart from a clean database (below). |
| You want to start over | `docker compose down --volumes`, then the four commands under [First time](#first-time) from `npm run db:up`. This deletes all local data. |

### Set up your event

1. Go to `/admin`, leave the email blank and sign in with `ADMIN_PASSWORD`.
2. **Team** tab: create your own owner account, and one for each organizer.
   Then sign in as yourself and keep `ADMIN_PASSWORD` for emergencies.
3. **Judges** tab: add judges and mentors, then set the shared sign-in
   password and send it to them yourself.
4. **Home** tab: open registration and submissions when you're ready, switch
   to **judging** to start scoring, then **results**.

Before real submissions open, remove the samples with
`npm run db:seed -- --cleanup`.

## Database options

Dua works with any Postgres 14 or newer, on your machine or hosted. It connects using one setting,
`DATABASE_URL`, in `.env.local`.

### Docker Desktop

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/),
start it, then run:

```bash
npm run db:up
```

This starts the `db` service from [`docker-compose.yml`](docker-compose.yml):
Postgres 17, listening on port **54329** of your machine so it won't clash
with a Postgres you already run on 5432. The `DATABASE_URL` in
`.env.local.example` already points at it. Your data is kept in a Docker
volume and survives restarts.

| To | Run |
| --- | --- |
| Stop the database, keeping the data | `docker compose stop` |
| Start it again | `npm run db:up` |
| Delete the database and its data | `docker compose down --volumes` |
| Open a SQL prompt | `docker compose exec db psql -U dua -d dua` |

### OrbStack

[OrbStack](https://orbstack.dev) is a lighter replacement for Docker Desktop
on macOS, and it runs the same commands. Open OrbStack, then:

```bash
npm run db:up
```

Everything in the Docker Desktop section applies. OrbStack also gives the
container a name on your machine, so this address works as well as
`localhost:54329`:

```
postgres://dua:dua@db.dua-platform.orb.local:5432/dua
```

(The middle part is the folder name; it changes if you clone into a
differently named folder.) You can stop and start the container from the
OrbStack window.

### pgAdmin

[pgAdmin](https://www.pgadmin.org) is a visual tool for browsing tables and
running queries. You don't need it to run Dua. There are two ways to use it.

**In the browser, from the compose file:**

```bash
docker compose --profile tools up -d pgadmin
```

Open <http://localhost:5050>, then choose **Add New Server** and enter:

| Field | Value |
| --- | --- |
| General → Name | `Dua` |
| Connection → Host name/address | `db` |
| Connection → Port | `5432` |
| Connection → Maintenance database | `dua` |
| Connection → Username | `dua` |
| Connection → Password | `dua` |

The host is `db` and the port `5432` because pgAdmin is running beside the
database inside Docker. Stop it with `docker compose stop pgadmin`.

**The pgAdmin desktop app:** use the same values, but with host `localhost`
and port `54329`.

Your tables are under **Servers → Dua → Databases → dua → Schemas → public →
Tables**. Right-click a table and choose **View/Edit Data** to see its rows.

### Supabase

[Supabase](https://supabase.com) hosts Postgres, so Dua runs on it without
any Docker on your machine. The free tier is enough for one event.

1. Create a project and save the database password it gives you.
2. Click **Connect** at the top of the project page and copy the
   **Session pooler** connection string. It starts with `postgresql://` and
   ends with `:5432/postgres`.
3. Put it in `.env.local` as `DATABASE_URL`, with your password in place of
   `[YOUR-PASSWORD]`.
4. Run `npm run db:migrate`.

Your tables then show up in Supabase's **Table Editor**, which does the same
job as pgAdmin.

Dua uses Supabase as a database only. It signs people in and stores files
itself, so you don't need Supabase's API keys, Auth or Storage. Supabase also
publishes every table through an API of its own; Dua switches on row-level
security for all its tables, so that API returns nothing.

### A Postgres you already have

Local, or hosted (Neon, Amazon RDS, Render and others all work):
create an empty database, put its connection string in `DATABASE_URL`, and run
`npm run db:migrate`. For example, with a local Postgres:

```bash
createdb dua
# .env.local
DATABASE_URL=postgres://localhost:5432/dua
```

Hosted providers usually need `?sslmode=require` on the end of the URL.

## Configuration

| Variable | Needed | What it's for |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. |
| `ADMIN_PASSWORD` | Yes | Break-glass owner password for `/admin`. |
| `SUBMISSION_EDIT_SECRET` | Yes | 32+ random characters. Signs sessions and private links. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public address of your deployment, used in emails. |
| `RESEND_API_KEY` | For email | [Resend](https://resend.com) API key. |
| `EMAIL_FROM` | For email | From header on a domain Resend has verified. |
| `DUA_EVENT_SLUG` | No | Which event in the database to serve. Defaults to `default`. |

## Make it yours

| To change | Edit |
| --- | --- |
| Event name, dates, host, contact email, deadlines | [`src/lib/site.ts`](src/lib/site.ts) |
| Tracks, problem briefs, partner groups, dropdown options | [`src/lib/hackathon.ts`](src/lib/hackathon.ts) |
| Judging criteria, weights and guidance | [`src/lib/rubric.ts`](src/lib/rubric.ts) |
| Homepage copy | [`src/app/page.tsx`](src/app/page.tsx) |
| Submission form options | [`src/app/submit/submit-form.tsx`](src/app/submit/submit-form.tsx) |
| Colours and fonts | [`tailwind.config.ts`](tailwind.config.ts), [`src/app/globals.css`](src/app/globals.css) |
| Logo | [`src/components/dua-mark.tsx`](src/components/dua-mark.tsx), `public/email-logo.png`, `src/app/icon.svg` |

Editing code to configure an event is a stopgap. The roadmap moves all of this
into settings an organizer edits in the admin panel.

## How judging works

The ranking logic is in [`src/lib/monte-carlo.ts`](src/lib/monte-carlo.ts) and
the rubric in [`src/lib/rubric.ts`](src/lib/rubric.ts). Both are covered by
tests.

1. **Per-judge normalization.** Each judge's scores on each criterion are
   rescaled to mean 0 and standard deviation 1 before the weights are applied.
   A judge who gives everyone 5s doesn't outweigh one who centres on 3.
2. **Shrinkage for thin evidence.** A project scored by few judges is pulled
   toward neutral by `n / (n + k)`, with `k = 3`. One enthusiastic judge doesn't
   beat nine judges who broadly agree.
3. **Monte Carlo.** 1,000 trials each add noise to every score, scaled by that
   judge's own spread, and re-rank. A project's chance of placing is the share
   of trials it landed in the top places. The seed is logged, so anyone can
   reproduce the result.
4. **Selection.** Projects that place in at least 70% of trials are locked in.
   Remaining places are drawn from the rest, weighted by their chance of
   placing, using the same seed.
5. **Ties.** Level rankings are ordered by the tie-breaker criteria. Pairs the
   tie-breakers can't separate are flagged for the panel to decide.

A recused judge's scores never count: declaring a conflict deletes any score
that judge gave the project, and new ones are refused.

## Who can see what

These rules are written as plain functions in
[`src/server/policy.ts`](src/server/policy.ts) and enforced by every function
in [`src/server/`](src/server/) that reads or writes on someone's behalf. The
tests beside them run against a real database.

| Who | Can |
| --- | --- |
| Public | Register and submit while the admin has those forms open. Edit their own submission through its private link. |
| Judges | See complete, unhidden submissions once judging opens, without any contact details. Read and write only their own scores and conflicts. See panel averages and anonymous notes once results open. |
| Mentors | See what judges see. Never score. |
| Admins | See everything, including contact details. Preview results at any time. |
| Admins with the viewer role | See everything admins see. Change nothing. |

## Deploying

Dua is a standard Next.js app. Wherever you host it:

1. Set the variables from [Configuration](#configuration).
2. Run `npm run db:migrate` against your database on each deploy. It skips
   migrations that have already been applied.
3. Run `npm run build`, then `npm run start`.

On Vercel, import the repository, add the variables, and set the build command
to `npm run db:migrate && npm run build`.

## Roadmap

1. **Pluggable providers.** Email over SMTP as well as Resend, and file
   storage on S3-compatible services as well as in the database.
2. **Events as data.** Event details, tracks, rubric, form fields and theme
   editable in the admin panel instead of in code. More than one event per
   deployment (the database is already built for it).
3. **One-command setup.** A container image for the app, alongside the
   database one.

## Development

```bash
npm run dev           # local server
npm test              # tests; needs the database running (npm run db:up)
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run build         # production build
npm run db:generate   # after editing src/db/schema.ts: write a new migration
```

Tests use their own database, `dua_test`, created automatically on the same
Postgres server. They never touch your development data.

```
src/
├── app/         # pages and server actions, one folder per area
├── components/  # shared layout: header, footer, logo, theme toggle
├── db/          # the database schema and connection
├── lib/         # event config, rubric, ranking, email, validation
└── server/      # all database reads and writes, and who may make them
drizzle/         # SQL migrations, generated from src/db/schema.ts
scripts/         # command-line helpers: migrate, seed, admins, imports
test/            # test database setup and fixtures
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first; you'll
be asked to sign the [contributor license agreement](CLA.md) on your first pull
request. Please report security problems privately, as described in
[SECURITY.md](SECURITY.md).

## License

[GNU Affero General Public License v3.0](LICENSE). You can use, change and
host Dua freely. If you run a changed version as a service for other people,
you must make your changes available to them under the same license.
