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

export function getPool(): Pool {
  if (!holder.__duaPool) {
    holder.__duaPool = new Pool({
      connectionString: connectionString(),
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
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
