<p align="center">
  <img src="public/dua-logo.svg" alt="Dua" width="320">
</p>

# Dua

Dua is an open source platform for running a hackathon from first sign-up to
final results: registration, mentor sign-up, project submission, judging and a
leaderboard, in one app you host yourself.

It was built for a real event and then opened up. What sets it apart is the
judging: every score needs a sentence of evidence, scores are normalized per
judge so a harsh judge and a generous one carry the same weight, judges can
recuse themselves, and the final ranking can be reproduced from a logged seed.

> **Status: early.** Dua runs today, but it still needs a Supabase project and
> the sample event is energy-themed in places. The [roadmap](#roadmap) covers
> what's changing. Expect the database schema to change before 1.0.

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
effect immediately. Passwords are stored as scrypt hashes.

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
   of trials it landed in the top N. The seed is logged, so anyone can
   reproduce the result.
4. **Selection.** Projects that place in at least 70% of trials are locked in.
   Remaining places are drawn from the rest, weighted by their chance of
   placing, using the same seed.
5. **Ties.** Level rankings are ordered by the tie-breaker criteria. Pairs the
   tie-breakers can't separate are flagged for the panel to decide.

A recused judge's scores never count: declaring a conflict deletes any score
that judge gave the project, and the database refuses new ones.

## Quick start

You need Node.js 20.18 or newer and a free [Supabase](https://supabase.com)
project.

### 1. Get the code

```bash
git clone <this repository's URL>
cd dua-platform
npm install
cp .env.local.example .env.local
```

### 2. Create the database

1. Create a Supabase project and wait for it to finish provisioning.
2. In **SQL Editor**, run every file in
   [`supabase/migrations/`](supabase/migrations/) in order, `0001` to `0023`.
   Each one is safe to re-run.
3. From **Settings → API**, copy the project URL, the publishable key and the
   secret key into `.env.local`.

### 3. Fill in the rest of `.env.local`

| Variable | Needed | What it's for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public key, safe in the browser. |
| `SUPABASE_SECRET_KEY` | Yes | Server-only key. Never expose it to the browser. |
| `ADMIN_PASSWORD` | Yes | Break-glass owner password for `/admin`. |
| `SUBMISSION_EDIT_SECRET` | Yes | 32+ random characters. Signs sessions and private links. `openssl rand -hex 32` makes one. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public address of your deployment, used in emails. |
| `RESEND_API_KEY` | For email | [Resend](https://resend.com) API key. |
| `EMAIL_FROM` | For email | From header on a domain Resend has verified. |

### 4. Run it

```bash
npm run dev
```

Open <http://localhost:3000>.

### 5. Set up your event

1. Go to `/admin`, leave the email blank and sign in with `ADMIN_PASSWORD`.
2. **Team** tab: create your own owner account, and one for each organizer.
   Then sign in as yourself and keep `ADMIN_PASSWORD` for emergencies.
3. **Judges** tab: add judges and mentors, then set the shared sign-in
   password and send it to them yourself.
4. **Phase** tab: open registration and submissions when you're ready, switch
   to **judging** to start scoring, then **results**.

To try judging with sample projects:

```bash
node --env-file=.env.local scripts/demo-data.mjs            # add samples
node --env-file=.env.local scripts/demo-data.mjs --cleanup  # remove them
```

## Make it yours

| To change | Edit |
| --- | --- |
| Event name, dates, host, contact email, deadlines | [`src/lib/site.ts`](src/lib/site.ts) |
| Tracks, problem briefs, partner groups, dropdown options | [`src/lib/hackathon.ts`](src/lib/hackathon.ts) |
| Judging criteria, weights and guidance | [`src/lib/rubric.ts`](src/lib/rubric.ts), and `rubric_aggregates()` in `0020_handbook_v2_rubric.sql`. Change both together. |
| Homepage copy | [`src/app/page.tsx`](src/app/page.tsx) |
| Colours and fonts | [`tailwind.config.ts`](tailwind.config.ts), [`src/app/globals.css`](src/app/globals.css) |
| Logo | [`src/components/dua-mark.tsx`](src/components/dua-mark.tsx), `public/email-logo.png`, `src/app/icon.svg` |

Editing code to configure an event is a stopgap. The roadmap moves all of this
into settings an organizer edits in the admin panel.

## Deploying

Dua is a standard Next.js app. On Vercel: import the repository, add the
variables from `.env.local`, and deploy. Any host that runs `npm run build`
and `npm run start` on Node.js 20.18+ works too.

## Roadmap

1. **Any Postgres.** Replace the Supabase client with one schema that runs on
   any Postgres database, and move permission rules from database policies
   into tested server code.
2. **Pluggable providers.** Sign-in, email (Resend, SMTP) and file storage
   (S3-compatible, local disk) behind small adapters.
3. **Events as data.** Event details, tracks, rubric, form fields and theme
   editable in the admin panel instead of in code. Support for more than one
   event per deployment.
4. **One-command setup.** Docker Compose with a seeded demo event.

## Development

```bash
npm run dev         # local server
npm test            # unit tests
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run build       # production build
```

```
src/
├── app/            # pages and server actions, one folder per area
├── components/     # shared layout: header, footer, logo, theme toggle
└── lib/            # event config, rubric, ranking, email, validation
supabase/migrations/  # database schema, run in order
scripts/              # command-line helpers: admins, demo data, imports
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
