# Providers: email, file storage and sign-in

Email, file storage and judge sign-in each have a built-in default and
alternatives you switch to with a setting. Mix them however you like: for
example Supabase for the database and sign-in, with email over SMTP.

## Email

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

## File storage

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

## Judge sign-in

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

---

[Back to the README](../README.md) · [All guides](README.md)
