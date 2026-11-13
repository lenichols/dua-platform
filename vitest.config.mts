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
  },
});
