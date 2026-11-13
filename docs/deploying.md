# Deploying and settings

Dua is a standard Next.js app. Wherever you host it:

1. Set the variables under [Settings](#settings).
2. Run `npm run db:migrate` against your database on each deploy. It skips
   migrations that have already been applied.
3. Run `npm run build`, then `npm run start`.

## On Vercel

Import the repository and add the variables. [`vercel.json`](../vercel.json)
already sets the build to run the migrations first, so there is nothing else
to configure.

Use a pooled connection string for the database, because each running copy of
the app opens its own connections. With Supabase that's the **Transaction
pooler** string from the project's **Connect** panel (port 6543), and set
`DATABASE_POOL_MAX=3`. If your password has characters such as `@` or `#`,
percent-encode them in the URL.

`vercel.json` also schedules an hourly call to `/api/demo/reset`. On a real
event that address doesn't exist and the call does nothing; it only matters
for a public demo, below.

## Running a public demo

A demo site shows working logins on its sign-in pages, so it needs two things
a real event doesn't: visitors mustn't be able to wreck it, and whatever they
do change should put itself back.

Set these in addition to the required settings:

| Variable | Value | Why |
| --- | --- | --- |
| `DEMO_MODE` | `true` | Shows the sample logins and a banner saying the site is a demo. The first deploy loads the sample event. |
| `DEMO_ADMIN_ROLE` | `viewer` | Makes the sample admin read-only: visitors can look around the admin panel but not change settings, send email or upload files. Leave it out and the sample admin can run the event. |
| `CRON_SECRET` | a long random string | Lets the hourly reset run, and only the scheduler. On Vercel the scheduler sends it automatically. |

Don't set an email provider on a demo, so nothing can be sent from it.

The reset wipes everything visitors can change for the event (scores,
registrations, submissions, settings) and loads the samples again. It leaves
your own admin accounts alone, so you can still sign in with `ADMIN_PASSWORD`
or an account you created. To run it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-demo.example.org/api/demo/reset
```

Off Vercel, call that address from any scheduler you have.

## Settings

Every setting Dua reads from the environment. Locally they go in `.env.local`; on a host, wherever it keeps environment variables. `.env.local.example` has the same list with comments.

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
| `DEMO_ADMIN_ROLE` | No | `viewer` makes the sample admin read-only. For public demos. |
| `CRON_SECRET` | For a public demo | Required by the scheduled reset at `/api/demo/reset`. |
| `DATABASE_POOL_MAX` | No | Most connections each copy of the app opens. Defaults to 10; use about 3 on serverless hosts. |
| `DATABASE_SSL` | No | `require` encrypts the database connection and checks its certificate; `no-verify` encrypts without checking. Unset leaves it to the connection string. |
| `DUA_EVENT_SLUG` | No | Which event in the database to serve. Defaults to `default`. |

## Command-line helpers

Run these from the project folder, against the database in `DATABASE_URL`.

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Brings the database up to date. Safe to run on every deploy. |
| `npm run db:seed` | Adds the sample projects and logins. `-- --cleanup` removes them. |
| `node --env-file=.env.local scripts/create-admin.mjs --email you@example.org --name "Your Name" --role owner` | Creates or updates an admin account and prints its password once. |
| `node --env-file=.env.local scripts/import-registrations.mjs export.csv` | Previews importing registrations from a spreadsheet or CSV export. Add `--commit` to save them. |

---

[Back to the README](../README.md)
