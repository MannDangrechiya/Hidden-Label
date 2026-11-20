import { defineConfig } from "vitest/config";

/**
 * Default test run: pure unit tests only, no database or network required. Database
 * integration tests live in `*.integration.test.ts` and run through `pnpm test:integration`
 * (see `vitest.integration.config.ts`), which CI provisions PostgreSQL for.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
  },
});
