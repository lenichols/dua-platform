import type { NextConfig } from "next";

// The project root is wherever Next.js is started from. Saying so stops it
// guessing from lockfiles, which goes wrong when a parent folder has one too.
const root = process.cwd();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
