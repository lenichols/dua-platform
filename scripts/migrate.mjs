#!/usr/bin/env node
// Bring the database up to date. Safe to run on every deploy: migrations that
// have already been applied are skipped.
//
//   npm run db:migrate
//
// Also makes sure the event this deployment serves exists.

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  const slug = process.env.DUA_EVENT_SLUG?.trim() || "default";
  const { rowCount } = await pool.query(
    "insert into events (slug) values ($1) on conflict (slug) do nothing",
    [slug],
  );
  console.log(`Database is up to date. Event "${slug}" ${rowCount ? "created" : "already exists"}.`);
} catch (e) {
  console.error("Migration failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
