# Development

For people changing Dua itself. Read [CONTRIBUTING.md](../CONTRIBUTING.md) before opening a pull request.

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

---

[Back to the README](../README.md) · [All guides](README.md)
