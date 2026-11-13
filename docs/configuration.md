# Settings

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
| `DUA_EVENT_SLUG` | No | Which event in the database to serve. Defaults to `default`. |

---

[Back to the README](../README.md) · [All guides](README.md)
