import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Parent folder has another lockfile; pin Turbopack to this app so `tailwindcss` resolves from `frontend/node_modules`.
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
