# Deploying

Dua is a standard Next.js app. Wherever you host it:

1. Set the variables from [Configuration](configuration.md).
2. Run `npm run db:migrate` against your database on each deploy. It skips
   migrations that have already been applied.
3. Run `npm run build`, then `npm run start`.

On Vercel, import the repository, add the variables, and set the build command
to `npm run db:migrate && npm run build`.

---

[Back to the README](../README.md) · [All guides](README.md)
