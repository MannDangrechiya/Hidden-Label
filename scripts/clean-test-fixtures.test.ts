import { describe, it, expect, vi } from "vitest";
import {
  validateSafetyPreconditions,
  purgeTestBrands,
  sanitizeDatabaseUrl,
} from "./clean-test-fixtures";

describe("Database Fixture Cleanup Safety Guards", () => {
  describe("sanitizeDatabaseUrl", () => {
    it("sanitizes password and username from database URL", () => {
      const sanitized = sanitizeDatabaseUrl(
        "postgres://secret_user:super_secret_pass@127.0.0.1:5432/test_db"
      );
      expect(sanitized).toBe("postgres://127.0.0.1:5432/test_db");
      expect(sanitized).not.toContain("super_secret_pass");
      expect(sanitized).not.toContain("secret_user");
    });

    it("handles malformed URLs safely", () => {
      const sanitized = sanitizeDatabaseUrl("not-a-valid-url");
      expect(sanitized).toBe("[MALFORMED DATABASE URL]");
    });
  });

  describe("validateSafetyPreconditions", () => {
    it("strictly refuses execution when NODE_ENV is production", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "production", databaseUrl: "postgres://localhost:5432/test_db" },
        ["--execute", "--confirm-environment=production"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("NODE_ENV=production");
    });

    it("strictly refuses execution when NODE_ENV is undefined or unrecognized (fail-closed)", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: undefined, databaseUrl: "postgres://localhost:5432/test_db" },
        ["--execute", "--confirm-environment=test"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Cannot establish safe non-production environment");
    });

    it("strictly refuses execution when DATABASE_URL is missing", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "test", databaseUrl: "" },
        ["--execute", "--confirm-environment=test"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("DATABASE_URL is missing");
    });

    it("strictly refuses execution when DATABASE_URL is malformed", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "test", databaseUrl: "http://invalid-db-scheme:5432" },
        ["--execute", "--confirm-environment=test"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Malformed DATABASE_URL");
    });

    it("strictly refuses execution when DATABASE_URL host targets production", () => {
      const result = validateSafetyPreconditions(
        {
          nodeEnv: "development",
          databaseUrl: "postgres://thl_user:pass@postgres.prod.internal.thehiddenlabel.com:5432/the_hidden_label",
        },
        ["--execute", "--confirm-environment=development"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("target production infrastructure");
    });

    it("strictly refuses execution when DATABASE_URL database name targets production", () => {
      const result = validateSafetyPreconditions(
        {
          nodeEnv: "development",
          databaseUrl: "postgres://thl_user:pass@localhost:5432/the_hidden_label_production",
        },
        ["--execute", "--confirm-environment=development"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("indicates production infrastructure");
    });

    it("strictly refuses execution when host is not on authorized host allowlist during --execute", () => {
      const result = validateSafetyPreconditions(
        {
          nodeEnv: "staging",
          databaseUrl: "postgres://user:pass@unknown-external-host.com:5432/staging_db",
        },
        ["--execute", "--confirm-environment=staging"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("not on the authorized non-production database allowlist");
    });

    it("rejects the decommissioned --force flag", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "test", databaseUrl: "postgres://localhost:5432/test_db" },
        ["--execute", "--confirm-environment=test", "--force"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("--force flag has been permanently decommissioned");
    });

    it("allows dry-run by default when environment is safe", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "development", databaseUrl: "postgres://localhost:5432/dev_db" },
        []
      );

      expect(result.allowed).toBe(true);
      expect(result.isExecute).toBe(false);
      expect(result.environment).toBe("development");
    });

    it("refuses --execute when --confirm-environment is missing", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "development", databaseUrl: "postgres://localhost:5432/dev_db" },
        ["--execute"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("requires explicit --confirm-environment");
    });

    it("refuses --confirm-environment=production", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "development", databaseUrl: "postgres://localhost:5432/dev_db" },
        ["--execute", "--confirm-environment=production"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("strictly disallowed");
    });

    it("strictly rejects environment mismatch between NODE_ENV=development and --confirm-environment=staging", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "development", databaseUrl: "postgres://localhost:5432/dev_db" },
        ["--execute", "--confirm-environment=staging"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Environment mismatch");
    });

    it("strictly rejects environment mismatch between NODE_ENV=test and --confirm-environment=development", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "test", databaseUrl: "postgres://localhost:5432/test_db" },
        ["--execute", "--confirm-environment=development"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Environment mismatch");
    });

    it("strictly rejects environment mismatch between NODE_ENV=staging and --confirm-environment=test", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "staging", databaseUrl: "postgres://localhost:5432/staging_db" },
        ["--execute", "--confirm-environment=test"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("Environment mismatch");
    });

    it("allows execution when NODE_ENV=development matches --confirm-environment=development", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "development", databaseUrl: "postgres://127.0.0.1:5432/dev_db" },
        ["--execute", "--confirm-environment=development"]
      );

      expect(result.allowed).toBe(true);
      expect(result.isExecute).toBe(true);
      expect(result.environment).toBe("development");
    });

    it("allows execution when NODE_ENV=staging matches --confirm-environment=staging", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "staging", databaseUrl: "postgres://thl-postgres-staging:5432/staging_db" },
        ["--execute", "--confirm-environment=staging"]
      );

      expect(result.allowed).toBe(true);
      expect(result.isExecute).toBe(true);
      expect(result.environment).toBe("staging");
    });

    it("allows execution when NODE_ENV=test matches --confirm-environment=test", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "test", databaseUrl: "postgres://localhost:5432/test_db" },
        ["--execute", "--confirm-environment=test"]
      );

      expect(result.allowed).toBe(true);
      expect(result.isExecute).toBe(true);
      expect(result.environment).toBe("test");
    });
  });

  describe("purgeTestBrands Transactional Integrity", () => {
    it("aborts and throws if products are linked to the target brands", async () => {
      const mockTrx = vi.fn().mockImplementation((table: string) => {
        if (table === "product_brand") {
          return {
            whereIn: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue([{ count: "3" }]),
            }),
          };
        }
        return {};
      });

      const mockDb = {
        transaction: vi.fn().mockImplementation(async (callback) => {
          return callback(mockTrx);
        }),
      } as any;

      await expect(purgeTestBrands(mockDb, ["brand_123"])).rejects.toThrow(
        "TRANSACTION ABORT: 3 products are linked to target brands"
      );
    });

    it("deletes brands when linked product count is zero", async () => {
      const mockDelete = vi.fn().mockResolvedValue(2);
      const mockTrx = vi.fn().mockImplementation((table: string) => {
        if (table === "product_brand") {
          return {
            whereIn: vi.fn().mockReturnValue({
              count: vi.fn().mockResolvedValue([{ count: "0" }]),
            }),
          };
        }
        if (table === "brand") {
          return {
            whereIn: vi.fn().mockReturnValue({
              delete: mockDelete,
            }),
          };
        }
        return {};
      });

      const mockDb = {
        transaction: vi.fn().mockImplementation(async (callback) => {
          return callback(mockTrx);
        }),
      } as any;

      const deleted = await purgeTestBrands(mockDb, ["brand_1", "brand_2"]);
      expect(deleted).toBe(2);
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
