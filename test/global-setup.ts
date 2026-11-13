// Runs once before the test suite: makes sure the test database exists and
// is on the current schema. Tests use their own database, never yours.

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { TEST_DATABASE_URL } from "./database-url";

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name) || !name.includes("test"))
    throw new Error(
      `Refusing to run tests against "${name}": the test database name must contain "test".`,
    );

  // Create the database if it isn't there, from the server's default one.
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  try {
    await admin.connect();
  } catch (e) {
    throw new Error(
      `Can't reach Postgres at ${url.host}. Start it with "npm run db:up", or set TEST_DATABASE_URL. (${(e as Error).message})`,
    );
  }
  const exists = await admin.query("select 1 from pg_database where datname = $1", [name]);
  if (exists.rowCount === 0) await admin.query(`create database ${name}`);
  await admin.end();

  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}
