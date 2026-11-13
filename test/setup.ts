// Runs in every test file before anything else is imported.
import { afterAll } from "vitest";
import { TEST_DATABASE_URL } from "./database-url";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SUBMISSION_EDIT_SECRET = "test-secret-not-used-anywhere-real";

afterAll(async () => {
  const { getPool } = await import("@/db");
  const holder = globalThis as unknown as { __duaPool?: unknown; __duaDb?: unknown };
  if (holder.__duaPool) {
    await getPool().end();
    holder.__duaPool = undefined;
    holder.__duaDb = undefined;
  }
});
