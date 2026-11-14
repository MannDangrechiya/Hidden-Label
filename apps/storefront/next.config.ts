import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next transpiles them rather than needing a
  // build step in each package.
  transpilePackages: ["@thl/shared", "@thl/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
