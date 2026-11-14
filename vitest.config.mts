import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `npm test` runs the tests beside the code. `npm run test:live` sets
// LIVE_TESTS and runs test/live instead: checks of the optional providers
// against real services (see test/live/providers.live.test.ts).
const live = Boolean(process.env.LIVE_TESTS);

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: live ? ["test/live/**/*.test.ts"] : ["src/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // The database tests share one test database, so files run one at a time.
    fileParallelism: false,
    testTimeout: live ? 30_000 : 5_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Floors match the current suite; raise them as provider and UI tests
      // are added rather than letting coverage slip.
      thresholds: {
        statements: 79,
        branches: 71,
        functions: 79,
        lines: 80,
      },
    },
  },
});
