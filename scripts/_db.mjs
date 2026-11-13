// Database access for the command-line scripts.

import pg from "pg";
import { die } from "./_password.mjs";

/** A connection pool from DATABASE_URL. Remember to `await pool.end()`. */
export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) die("DATABASE_URL is not set — pass --env-file=.env.local");
  return new pg.Pool({ connectionString: url, max: 2 });
}

/** The id of the event this deployment serves (DUA_EVENT_SLUG, or "default"). */
export async function currentEventId(pool) {
  const slug = process.env.DUA_EVENT_SLUG?.trim() || "default";
  const { rows } = await pool.query("select id from events where slug = $1", [slug]);
  if (!rows[0]) die(`No event "${slug}" in the database — run: npm run db:migrate`);
  return rows[0].id;
}

/**
 * Insert one row from an object. Column names come from the script itself,
 * never from user input.
 */
export async function insertRow(pool, table, row, returning = "id") {
  const cols = Object.keys(row);
  const params = cols.map((_, i) => "$" + (i + 1));
  const text =
    "insert into " + table + " (" + cols.join(", ") + ") values (" + params.join(", ") + ") returning " + returning;
  const { rows } = await pool.query(
    text,
    cols.map((c) => row[c]),
  );
  return rows[0];
}
