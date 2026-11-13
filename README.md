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

All it needs is Node.js and a Postgres database. Email, file storage and
judge sign-in work out of the box and can each be switched to a service you
already use, including Supabase.

> **Status: early.** Dua runs today and ships with a made-up sample event, the
> Open Build Hackathon. Expect the database schema to change before 1.0; the
> [to-do list](#to-do) covers what isn't done yet.

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
npm run db:seed      # add five sample projects and sample judge, mentor and admin logins
npm run dev          # start the site
```

Open <http://localhost:3000>.

### What to look at

`.env.local.example` turns on **demo mode**, so the seed creates three sample
accounts with fixed passwords, and each sign-in page lists them: click one to
fill in the form.

| To see | Go to | Sign in as |
| --- | --- | --- |
| The public site | <http://localhost:3000> | Nobody |
| A judge's view | <http://localhost:3000/judge> | `demo.judge@example.org` / `dua-demo-judge` |
| A mentor's view | <http://localhost:3000/judge> | `demo.mentor@example.org` / `dua-demo-mentor` |
| The admin panel | <http://localhost:3000/admin> | `demo.admin@example.org` / `dua-demo-admin` |

The sample admin can run the event but can't manage admin accounts. For full
access, leave the email blank and enter your `ADMIN_PASSWORD`.

Seeding puts the event in the **judging** phase so the sample judge can score,
which means the registration and submission forms show as closed. To see them
open: in the admin panel's **Home** tab, switch the phase to **submissions**,
then press **Open registration** and **Open submissions**.

> **Before a real event, turn demo mode off.** Remove `DEMO_MODE=true` from
> your settings and run `npm run db:seed -- --cleanup`. While it's on, anyone
> who can reach your site can read working logins off the sign-in pages.

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
| The sample logins don't work | Run `npm run db:seed` again. It resets the samples and their passwords. |
| `Too many failed attempts` at sign-in | Wait 15 minutes, or restart from a clean database (below). |
| You want to start over | `docker compose down --volumes`, then the four commands under [First time](#first-time) from `npm run db:up`. This deletes all local data. |

### Set up your event

1. Go to `/admin`, leave the email blank and sign in with `ADMIN_PASSWORD`.
2. **Team** tab: create your own owner account, and one for each organizer.
   Then sign in as yourself and keep `ADMIN_PASSWORD` for emergencies.
3. **Judges** tab: add judges and mentors, then set the shared sign-in
   password and send it to them yourself.
4. **Event** tab: put in your event's name, dates, tracks and rubric.
5. **Home** tab: open registration and submissions when you're ready, switch
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

That is all you need: Dua signs people in and stores files itself. If you'd
rather Supabase did those too, see [Providers](#providers); both are optional
and independent of each other.

Supabase publishes every table through an API of its own, readable with the
project's public key. Dua switches on row-level security for all its tables,
so that API returns nothing and accepts nothing.

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

## Providers

Email, file storage and judge sign-in each have a built-in default and
alternatives you switch to with a setting. Mix them however you like: for
example Supabase for the database and sign-in, with email over SMTP.

### Email

Used for campaign emails and for sending teams their private edit link.
Without it everything else still works, and edit links are shown on screen.

| Provider | Set | Notes |
| --- | --- | --- |
| [Resend](https://resend.com) | `RESEND_API_KEY` | Sends in batches of 100. |
| SMTP | `SMTP_URL` | Any mail server or service, e.g. `smtps://user:password@smtp.example.org:465`. |
| Console | `EMAIL_PROVIDER=console` | Prints each email to the server log and sends nothing. |

Set `EMAIL_FROM` too, to an address on a domain your provider has verified.
If both `RESEND_API_KEY` and `SMTP_URL` are set, Resend is used unless you
set `EMAIL_PROVIDER=smtp`.

To try email locally without sending anything, start the bundled inbox:

```bash
docker compose --profile tools up -d mailpit
```

Add `SMTP_URL=smtp://localhost:1025` to `.env.local`, restart `npm run dev`,
and read what the app sends at <http://localhost:8025>.

### File storage

Used for images in campaign emails. Files are public, because a mail client
has to load them without signing in.

| Provider | Set | Notes |
| --- | --- | --- |
| Database (default) | Nothing | Kept in Postgres, up to 4 MB each. Fine for a handful of images. |
| S3-compatible | `STORAGE_PROVIDER=s3` and the `S3_*` settings below | AWS S3, Cloudflare R2, Backblaze B2, DigitalOcean Spaces and others. |
| Supabase Storage | `STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Creates a public bucket, `dua-uploads`, the first time it's needed. |

For S3, the bucket must already exist and allow public reads, either directly
or through a CDN. Set `S3_PUBLIC_URL` to wherever its files are served from
if that isn't the same address they're uploaded to.

### Judge sign-in

| Provider | Set | Notes |
| --- | --- | --- |
| Built in (default) | Nothing | Passwords are stored as scrypt hashes in your database. |
| Supabase Auth | `AUTH_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Each judge becomes a user in your Supabase project when an admin sets their password. |

Only the password check is handed over. The roster in the admin panel still
decides who is a judge or mentor and who is active, so a Supabase user who
isn't on the roster can't sign in. Sessions and the lockout after repeated
failures work the same either way. Admin accounts always use the built-in
store.

Switching provider doesn't carry passwords across: set the shared judge
password again from the admin panel afterwards.

## Configuration

| Variable | Needed | What it's for |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. |
| `ADMIN_PASSWORD` | Yes | Break-glass owner password for `/admin`. |
| `SUBMISSION_EDIT_SECRET` | Yes | 32+ random characters. Signs sessions and private links. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public address of your deployment, used in emails. |
| `EMAIL_FROM` | For email | From header, on a domain your email provider has verified. |
| `RESEND_API_KEY` | For email via Resend | Resend API key. |
| `SMTP_URL` | For email via SMTP | Mail server address with credentials. |
| `EMAIL_PROVIDER` | No | `resend`, `smtp` or `console`. Worked out from the settings above if unset. |
| `STORAGE_PROVIDER` | No | `database` (default), `s3` or `supabase`. |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | For S3 storage | The bucket and credentials that can write to it. |
| `S3_REGION` | For S3 storage | Defaults to `us-east-1`. Use `auto` for Cloudflare R2. |
| `S3_ENDPOINT` | For S3 storage outside AWS | The service's address. |
| `S3_PUBLIC_URL` | No | Where the bucket's files are read from, if different. |
| `AUTH_PROVIDER` | No | `builtin` (default) or `supabase`, for judges and mentors. |
| `SUPABASE_URL` | For Supabase Auth or Storage | Your project's URL. |
| `SUPABASE_PUBLISHABLE_KEY` | For Supabase Auth | The project's publishable (or `anon`) key. |
| `SUPABASE_SECRET_KEY` | For Supabase Auth or Storage | The project's secret (or `service_role`) key. Never expose it. |
| `SUPABASE_STORAGE_BUCKET` | No | Defaults to `dua-uploads`. |
| `DEMO_MODE` | No | `true` shows sample logins on the sign-in pages and gives the seeded accounts fixed passwords. Never use it for a real event. |
| `DUA_EVENT_SLUG` | No | Which event in the database to serve. Defaults to `default`. |

## Make it yours

Sign in to `/admin` and open the **Event** tab. Everything about your event is
edited there and takes effect when you press Save:

| Section | What you can change |
| --- | --- |
| Basics | Name, tagline, dates, deadlines, format, prizes, host, contact email, largest team size. |
| Look | The accent colour used across the site (violet by default, lightened automatically in dark mode), and your own logo in place of the Dua mark. |
| Judging | The rubric: criteria, their weights, the guidance judges see, and which criteria settle ties. How many places the final ranking has. |
| Questions | Switch off built-in questions your event doesn't need, and add your own to the registration and submission forms: short or long text, pick one, pick any, or a link. Choose which answers judges see. |
| Form options | The choices on the registration, mentor and submission forms: tracks, problem briefs, experience levels and so on. |
| Homepage | The introduction, highlight cards, an example problem per track, and the questions and answers. |

Once the first judge has scored a project, the rubric's criteria and weights
are fixed, because changing them would change what existing scores mean.
Names and guidance can still be edited.

A new event starts with the sample content in
[`src/lib/event-settings.ts`](src/lib/event-settings.ts).

The site opens in a light theme; visitors can switch to dark from the header.
Fonts (Jost for headings, Atkinson Hyperlegible for everything else) and the
page background colours are set in code: [`src/app/layout.tsx`](src/app/layout.tsx)
and [`src/app/globals.css`](src/app/globals.css).

## How judging works

The ranking logic is in [`src/lib/monte-carlo.ts`](src/lib/monte-carlo.ts). It
uses your event's rubric, set in the admin panel, and is covered by tests.

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
| Judges | See complete, unhidden submissions once judging opens, without any contact details. Answers to your own questions reach them only where you tick "Show the answer to judges". Read and write only their own scores and conflicts. See panel averages and anonymous notes once results open. |
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

## To do

Dua works as it is. These are the things not done yet, none of them urgent.
They'll be picked up over time, and any of them is a good place to start if
you'd like to contribute: open an issue first so we can agree on the approach.

**Setup and testing**

- [ ] A container image for the app, so `docker compose up` starts everything
      and not only the database.
- [ ] An end-to-end test suite that drives a real browser through signing in,
      scoring, the Event tab and the public forms, and runs in CI.
- [ ] Check the optional providers against the real services: Resend, S3 on
      AWS itself, and a hosted Supabase project. So far they've been run
      against local stand-ins (see `npm run test:live`).

**Admin panel**

- [ ] Create and switch between events. The database already keeps every
      event's data separate; one deployment still serves one event.
- [ ] A screen-by-screen tidy of the admin panel. It follows the current
      look, but its layouts predate it.
- [ ] Set fonts and the page background colours from the Event tab. Today
      only the accent colour and logo can be changed there.

**Forms**

- [ ] Custom and switchable questions on the mentor sign-up form, as the
      registration and submission forms already have.
- [ ] A check of every page at phone width.
- [ ] Let organizers reorder questions, and place their own among the
      built-in ones rather than in a section at the end.

**Housekeeping**

- [ ] Rename `top6` in the code and database. The number of ranked places is
      a setting now; the name is left over from when it was fixed at six.
- [ ] Rework the two effects that set state on mount (theme toggle, admin
      paging), which lint currently reports as warnings.

## Development

```bash
npm run dev           # local server
npm test              # tests; needs the database running (npm run db:up)
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run build         # production build
npm run db:generate   # after editing src/db/schema.ts: write a new migration
npm run test:live     # optional: check providers against real services
```

Tests use their own database, `dua_test`, created automatically on the same
Postgres server. They never touch your development data.

```
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
