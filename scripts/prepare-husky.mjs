#!/usr/bin/env node
// Install Husky hooks locally, but never fail an install that intentionally
// omitted dev dependencies (for example the Docker production-deps stage or
// CI, where HUSKY=0).

import { execFileSync } from "node:child_process";

if (process.env.HUSKY === "0") {
  process.exit(0);
}

try {
  execFileSync("husky", { stdio: "inherit" });
} catch {
  console.warn("Husky is not installed; skipping git hooks (set HUSKY=1 to require them).");
}
