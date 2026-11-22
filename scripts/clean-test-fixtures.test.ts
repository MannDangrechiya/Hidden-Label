import { describe, it, expect, vi } from "vitest";
import {
  validateSafetyPreconditions,
  purgeTestBrands,
} from "./clean-test-fixtures";

describe("Database Fixture Cleanup Safety Guards", () => {
  describe("validateSafetyPreconditions", () => {
    it("strictly refuses execution when NODE_ENV is production", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "production", databaseUrl: "postgres://localhost/test_db" },
        ["--execute", "--confirm-environment=test"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("NODE_ENV=production");
    });

    it("strictly refuses execution when DATABASE_URL contains production hostnames", () => {
      const result = validateSafetyPreconditions(
        {
          nodeEnv: "development",
          databaseUrl: "postgres://thl_user:secret@postgres.prod.internal.thehiddenlabel.com:5432/the_hidden_label",
        },
        ["--execute", "--confirm-environment=staging"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("target production infrastructure");
    });

    it("rejects the decommissioned --force flag", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "test", databaseUrl: "postgres://localhost/test_db" },
        ["--execute", "--confirm-environment=test", "--force"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("--force flag has been decommissioned");
    });

    it("allows dry-run by default without mutation", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "development", databaseUrl: "postgres://localhost/dev_db" },
        []
      );

      expect(result.allowed).toBe(true);
      expect(result.isExecute).toBe(false);
    });

    it("refuses --execute when --confirm-environment is missing", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "development", databaseUrl: "postgres://localhost/dev_db" },
        ["--execute"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("requires explicit --confirm-environment");
    });

    it("refuses --confirm-environment=production", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "development", databaseUrl: "postgres://localhost/dev_db" },
        ["--execute", "--confirm-environment=production"]
      );

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("strictly disallowed");
    });

    it("allows execution when confirmed for staging", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "staging", databaseUrl: "postgres://localhost/staging_db" },
        ["--execute", "--confirm-environment=staging"]
      );

      expect(result.allowed).toBe(true);
      expect(result.isExecute).toBe(true);
      expect(result.environment).toBe("staging");
    });

    it("allows execution when confirmed for test", () => {
      const result = validateSafetyPreconditions(
        { nodeEnv: "test", databaseUrl: "postgres://localhost/test_db" },
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
