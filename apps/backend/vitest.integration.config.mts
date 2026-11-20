import { defineConfig } from "vitest/config";

/**
 * Database integration tests. Each suite creates and drops its own PostgreSQL schema, so these
 * run against a disposable database (CI service container) or a local development database
 * without touching application rows.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
