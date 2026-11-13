/** Where the tests keep their data. Matches docker-compose.yml by default. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://dua:dua@localhost:54329/dua_test";
