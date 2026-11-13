# Database options

Dua works with any Postgres 14 or newer, on your machine or hosted. It connects using one setting,
`DATABASE_URL`, in `.env.local`.

## Docker Desktop

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/),
start it, then run:

```bash
npm run db:up
```

This starts the `db` service from [`docker-compose.yml`](../docker-compose.yml):
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

## OrbStack

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

## pgAdmin

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

## Supabase

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
rather Supabase did those too, see [Providers](providers.md); both are optional
and independent of each other.

Supabase publishes every table through an API of its own, readable with the
project's public key. Dua switches on row-level security for all its tables,
so that API returns nothing and accepts nothing.

## A Postgres you already have

Local, or hosted (Neon, Amazon RDS, Render and others all work):
create an empty database, put its connection string in `DATABASE_URL`, and run
`npm run db:migrate`. For example, with a local Postgres:

```bash
createdb dua
# .env.local
DATABASE_URL=postgres://localhost:5432/dua
```

Hosted providers usually need `?sslmode=require` on the end of the URL.

---

[Back to the README](../README.md)
