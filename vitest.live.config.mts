import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// For `npm run test:live`: checks the optional providers against real
// services. See test/live/providers.live.test.ts for what to set.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/live/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
