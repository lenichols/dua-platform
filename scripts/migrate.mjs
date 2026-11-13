#!/usr/bin/env node
// Bring the database up to date. Safe to run on every deploy: migrations that
// have already been applied are skipped.
//
//   npm run db:migrate
//
// Also makes sure the event this deployment serves exists and, on a demo
// site, that the sample data is loaded.

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { databaseSsl } from "./_db.mjs";
import { hasDemoData, seedDemo } from "./_demo-seed.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1, ssl: databaseSsl() });
try {
  await migrate(drizzle(pool), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  const slug = process.env.DUA_EVENT_SLUG?.trim() || "default";
  const { rowCount } = await pool.query(
    "insert into events (slug) values ($1) on conflict (slug) do nothing",
    [slug],
  );
  console.log(`Database is up to date. Event "${slug}" ${rowCount ? "created" : "already exists"}.`);

  // A demo site should never come up empty: load the samples on first deploy.
  if (process.env.DEMO_MODE?.trim().toLowerCase() === "true") {
    const { rows } = await pool.query("select id from events where slug = $1", [slug]);
    if (!(await hasDemoData(pool, rows[0].id))) {
      await seedDemo(pool, rows[0].id, { demoMode: true, adminRole: process.env.DEMO_ADMIN_ROLE });
      console.log("Demo mode: loaded the sample event.");
    }
  }
} catch (e) {
  console.error("Migration failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
