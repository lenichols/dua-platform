import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// One pool per server process. Kept on globalThis so hot reloads in
// development reuse it instead of opening a new set of connections each time.
const holder = globalThis as unknown as { __duaPool?: Pool; __duaDb?: Db };

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "DATABASE_URL is not set. Point it at your Postgres database, e.g. postgres://dua:dua@localhost:54329/dua",
    );
  return url;
}

/**
 * DATABASE_SSL: "require" encrypts and checks the server's certificate;
 * "no-verify" encrypts without checking it, for hosts whose certificate
 * Node doesn't recognize. Unset leaves it to the connection string.
 */
export function databaseSsl(value = process.env.DATABASE_SSL): boolean | { rejectUnauthorized: false } | undefined {
  const v = value?.trim().toLowerCase();
  if (v === "require") return true;
  if (v === "no-verify") return { rejectUnauthorized: false };
  return undefined;
}

export function getPool(): Pool {
  if (!holder.__duaPool) {
    holder.__duaPool = new Pool({
      connectionString: connectionString(),
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      ssl: databaseSsl(),
    });
  }
  return holder.__duaPool;
}

/** The database. Connects on first use, so importing this never throws. */
export function db(): Db {
  if (!holder.__duaDb) holder.__duaDb = drizzle(getPool(), { schema });
  return holder.__duaDb;
}

/** Postgres error code for a unique-constraint violation. */
export function isUniqueViolation(e: unknown): boolean {
  const code =
    (e as { code?: string } | null)?.code ??
    (e as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505";
}

export { schema };
