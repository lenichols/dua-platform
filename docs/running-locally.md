# Running Dua locally

The [README](../README.md#quick-start) has the short version. This page is the full walk-through: what you need, what to look at once it is running, and what to do when something goes wrong.

## What you need

- [Node.js](https://nodejs.org) 22.9 or newer. Check with `node --version`.
- A way to run containers: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  or [OrbStack](https://orbstack.dev). Open it before you start.

No Docker? Use a hosted database instead; see
[Database options](database.md).

## First time

```bash
git clone https://github.com/lenichols/dua-platform.git
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

## What to look at

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

## Stopping and coming back

- Stop the site with `Ctrl+C` in the terminal running `npm run dev`.
- Stop the database with `docker compose stop`. Your data is kept.
- Next time, run `npm run db:up` and then `npm run dev`. Nothing else.
- After pulling new code, also run `npm install` and `npm run db:migrate`.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| `Cannot connect to the Docker daemon` | Open Docker Desktop or OrbStack, wait until it's running, and try again. |
| `DATABASE_URL is not set` | You haven't created `.env.local`. Run `cp .env.local.example .env.local`. |
| `No event "default" in the database` | Run `npm run db:migrate`. |
| `connect ECONNREFUSED` on port 54329 | The database isn't running. Run `npm run db:up`. |
| `Port 3000 is in use` | Something else is using it. Run `npm run dev -- -p 3001` and open port 3001 instead. |
| The sample logins don't work | Run `npm run db:seed` again. It resets the samples and their passwords. |
| `Too many failed attempts` at sign-in | Wait 15 minutes, or restart from a clean database (below). |
| You want to start over | `docker compose down --volumes`, then the four commands under [First time](../README.md#quick-start) from `npm run db:up`. This deletes all local data. |

---

[Back to the README](../README.md) · [All guides](README.md)
