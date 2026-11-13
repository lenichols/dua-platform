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
| Judging | `/judge` | Judges, mentors | Sign in, then score each project 1–5 on the rubric you set, with one sentence of evidence per score. Judges can declare a conflict to recuse themselves. Mentors can read but not score. |
| Results | `/results` | Judges, mentors, admins | Averages only, never one judge's scores, plus the final ranking. Visible once the phase is `results`. |
| Admin | `/admin` | Organizers | Phase control, registrations with CSV export, judges, submissions, results, email campaigns, and admin accounts with roles. |

The event moves through three phases, switched by an admin:
**submissions → judging → results**.

Organizers set up the whole event from the admin panel: its name and dates,
the questions on the forms, the rubric, the colours and logo.

## Quick start

You need [Node.js](https://nodejs.org) 22.9 or newer, and Docker Desktop or
OrbStack running.

```bash
git clone https://github.com/lenichols/dua-platform.git
cd dua-platform
npm install
cp .env.local.example .env.local
```

Open `.env.local` and fill in `ADMIN_PASSWORD` (make one up) and
`SUBMISSION_EDIT_SECRET` (`openssl rand -hex 32` prints one). Then:

```bash
npm run db:up        # start the database
npm run db:migrate   # create the tables
npm run db:seed      # add sample projects and sample logins
npm run dev          # start the site
```

Open <http://localhost:3000>. The sign-in pages at `/judge` and `/admin` list
sample logins you can click to use.

No Docker, or something not working? See
[Running Dua locally](docs/running-locally.md) and
[Database options](docs/database.md).

> **Before a real event, turn demo mode off.** Remove `DEMO_MODE=true` from
> `.env.local` and run `npm run db:seed -- --cleanup`. While it's on, the
> sign-in pages show working logins to anyone.

## Guides

| Guide | What's in it |
| --- | --- |
| [Running Dua locally](docs/running-locally.md) | The full walk-through, sample logins, stopping and restarting, troubleshooting. |
| [Database options](docs/database.md) | Docker Desktop, OrbStack, Supabase, your own Postgres, and browsing data with pgAdmin. |
| [Setting up your event](docs/your-event.md) | What organizers can change in the admin panel. |
| [How judging works](docs/judging.md) | The ranking method, and who can see what. |
| [Providers](docs/providers.md) | Email over Resend or SMTP, files in S3 or Supabase, judge sign-in through Supabase. |
| [Deploying and settings](docs/deploying.md) | Putting Dua on a server, every environment variable, and the command-line helpers. |

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

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](.github/CONTRIBUTING.md) first; you'll
be asked to sign the [contributor license agreement](.github/CLA.md) on your first pull
request. Please report security problems privately, as described in
[SECURITY.md](.github/SECURITY.md).

## License

[GNU Affero General Public License v3.0](LICENSE). You can use, change and
host Dua freely. If you run a changed version as a service for other people,
you must make your changes available to them under the same license.
