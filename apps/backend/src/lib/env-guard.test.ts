import { describe, expect, it } from "vitest";
import {
  assertNonProductionEnv,
  assertProductionEnv,
  isWeakSecret,
  validateNonProductionEnv,
  validateProductionEnv,
} from "./env-guard";

const STRONG_A = "a".repeat(48);
const STRONG_B = "b".repeat(48);

const validEnv = {
  DATABASE_URL: "postgres://user:pass@db.internal:5432/the_hidden_label",
  MEDUSA_JWT_SECRET: STRONG_A,
  MEDUSA_COOKIE_SECRET: STRONG_B,
  STOREFRONT_ORIGIN: "https://thehiddenlabel.com",
  ADMIN_ORIGIN: "https://admin.thehiddenlabel.com",
} as Record<string, string | undefined>;

function variables(env: Record<string, string | undefined>): string[] {
  return validateProductionEnv(env).map((issue) => issue.variable);
}

describe("Production configuration assertions (GAP-116, SEC-12)", () => {
  it("accepts a complete, strong production environment", () => {
    expect(validateProductionEnv(validEnv)).toEqual([]);
    expect(() => assertProductionEnv(validEnv)).not.toThrow();
  });

  it("rejects missing mandatory secrets by variable name", () => {
    const issues = validateProductionEnv({ DATABASE_URL: validEnv.DATABASE_URL });
    expect(issues.map((issue) => issue.variable)).toEqual(
      expect.arrayContaining(["MEDUSA_JWT_SECRET", "MEDUSA_COOKIE_SECRET"]),
    );
  });

  it("rejects the development defaults and placeholders", () => {
    expect(isWeakSecret("local_dev_jwt_secret")).toBe(true);
    expect(isWeakSecret("local_dev_cookie_secret")).toBe(true);
    expect(isWeakSecret("PROD_RANDOM_JWT_SECRET_HEX_32_BYTES_MINIMUM")).toBe(true);
    expect(isWeakSecret("PROD_RANDOM_COOKIE_SECRET_HEX_32_BYTES_MINIMUM")).toBe(true);
    expect(
      variables({
        ...validEnv,
        MEDUSA_JWT_SECRET: "local_dev_jwt_secret",
      }),
    ).toContain("MEDUSA_JWT_SECRET");
  });

  it("rejects unconfigured placeholders in database and redis URLs", () => {
    expect(
      variables({
        ...validEnv,
        DATABASE_URL: "postgres://user:PROD_STRONG_PASSWORD@host:5432/db",
      }),
    ).toContain("DATABASE_URL");

    expect(
      variables({
        ...validEnv,
        REDIS_URL: "redis://:PROD_REDIS_PASSWORD@host:6379",
      }),
    ).toContain("REDIS_URL");
  });

  it("rejects secrets that are too short", () => {
    expect(isWeakSecret("short")).toBe(true);
    expect(variables({ ...validEnv, MEDUSA_COOKIE_SECRET: "abc123" })).toContain(
      "MEDUSA_COOKIE_SECRET",
    );
  });

  it("rejects reuse of the same value for both secrets", () => {
    expect(
      variables({ ...validEnv, MEDUSA_COOKIE_SECRET: validEnv.MEDUSA_JWT_SECRET }),
    ).toContain("MEDUSA_COOKIE_SECRET");
  });

  it("requires https origins in production", () => {
    const issues = variables({
      ...validEnv,
      STOREFRONT_ORIGIN: "http://localhost:3000",
      ADMIN_ORIGIN: "http://localhost:7001",
    });
    expect(issues).toContain("STOREFRONT_ORIGIN");
    expect(issues).toContain("ADMIN_ORIGIN");
  });

  it("rejects a missing database url", () => {
    expect(variables({ ...validEnv, DATABASE_URL: undefined })).toContain("DATABASE_URL");
  });

  it("rejects OTP_DEV_ECHO in production", () => {
    expect(variables({ ...validEnv, OTP_DEV_ECHO: "true" })).toContain("OTP_DEV_ECHO");
  });

  it("rejects test Razorpay keys and placeholders in production", () => {
    expect(
      variables({
        ...validEnv,
        RAZORPAY_KEY_ID: "rzp_test_1234567890",
      }),
    ).toContain("RAZORPAY_KEY_ID");

    expect(
      variables({
        ...validEnv,
        RAZORPAY_KEY_ID: "rzp_live_PROD_KEY_ID",
      }),
    ).toContain("RAZORPAY_KEY_ID");

    expect(
      variables({
        ...validEnv,
        RAZORPAY_KEY_SECRET: "PROD_RAZORPAY_KEY_SECRET",
      }),
    ).toContain("RAZORPAY_KEY_SECRET");
  });

  it("throws with variable names but never with secret values", () => {
    let message = "";
    try {
      assertProductionEnv({ ...validEnv, MEDUSA_JWT_SECRET: "local_dev_jwt_secret" });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("MEDUSA_JWT_SECRET");
    expect(message).not.toContain("local_dev_jwt_secret");
  });

  describe("Non-production environment validation", () => {
    it("strictly rejects live Razorpay keys in staging or development", () => {
      const issues = validateNonProductionEnv({
        RAZORPAY_KEY_ID: "rzp_live_realSecretKey123",
      });
      expect(issues.map((i) => i.variable)).toContain("RAZORPAY_KEY_ID");
      expect(() =>
        assertNonProductionEnv({
          RAZORPAY_KEY_ID: "rzp_live_realSecretKey123",
        }),
      ).toThrow("live Razorpay keys");
    });

    it("allows test keys in staging or development", () => {
      const issues = validateNonProductionEnv({
        RAZORPAY_KEY_ID: "rzp_test_sandboxKey123",
      });
      expect(issues).toEqual([]);
      expect(() =>
        assertNonProductionEnv({
          RAZORPAY_KEY_ID: "rzp_test_sandboxKey123",
        }),
      ).not.toThrow();
    });
  });
});
