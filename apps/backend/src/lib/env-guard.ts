/**
 * Production & Staging configuration assertions (GAP-116, SEC-12).
 *
 * Enforces strict environment boundaries:
 * - Production: rejects weak secrets, development defaults, template placeholders, test payment keys, and non-HTTPS origins.
 * - Non-production / Staging: strictly forbids live Razorpay keys (rzp_live_*) to eliminate accidental live charges.
 *
 * Reports variable names and problems only — never secret values.
 */

const KNOWN_DEV_SECRETS = new Set([
  "local_dev_jwt_secret",
  "local_dev_cookie_secret",
  "local_dev_jwt_secret_change_me_0123456789abcdef",
  "local_dev_cookie_secret_change_me_0123456789abcdef",
  "ci_jwt_secret_0123456789abcdef",
  "ci_cookie_secret_0123456789abcdef",
  "PROD_RANDOM_JWT_SECRET_HEX_32_BYTES_MINIMUM",
  "PROD_RANDOM_COOKIE_SECRET_HEX_32_BYTES_MINIMUM",
  "PROD_STRONG_DATABASE_PASSWORD_MIN_32_CHARS",
  "PROD_STRONG_REDIS_PASSWORD_MIN_32_CHARS",
]);

const MIN_SECRET_LENGTH = 32;

export interface EnvIssue {
  variable: string;
  problem: string;
}

export function isWeakSecret(value: string | undefined): boolean {
  if (!value) return true;
  if (value.length < MIN_SECRET_LENGTH) return true;
  if (KNOWN_DEV_SECRETS.has(value)) return true;
  if (value.startsWith("PROD_") || value.includes("PROD_RANDOM_")) return true;
  return false;
}

function isHttpsOrigin(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProductionEnv(env: Record<string, string | undefined>): EnvIssue[] {
  const issues: EnvIssue[] = [];

  if (!env.DATABASE_URL) {
    issues.push({ variable: "DATABASE_URL", problem: "is required in production" });
  } else if (env.DATABASE_URL.includes("PROD_STRONG_PASSWORD")) {
    issues.push({ variable: "DATABASE_URL", problem: "contains unconfigured template placeholder password" });
  }

  if (env.REDIS_URL && env.REDIS_URL.includes("PROD_REDIS_PASSWORD")) {
    issues.push({ variable: "REDIS_URL", problem: "contains unconfigured template placeholder password" });
  }

  if (isWeakSecret(env.MEDUSA_JWT_SECRET)) {
    issues.push({
      variable: "MEDUSA_JWT_SECRET",
      problem: `must be set to a random value of at least ${MIN_SECRET_LENGTH} characters that is not a development default or placeholder`,
    });
  }

  if (isWeakSecret(env.MEDUSA_COOKIE_SECRET)) {
    issues.push({
      variable: "MEDUSA_COOKIE_SECRET",
      problem: `must be set to a random value of at least ${MIN_SECRET_LENGTH} characters that is not a development default or placeholder`,
    });
  }

  if (env.MEDUSA_JWT_SECRET && env.MEDUSA_COOKIE_SECRET && env.MEDUSA_JWT_SECRET === env.MEDUSA_COOKIE_SECRET) {
    issues.push({
      variable: "MEDUSA_COOKIE_SECRET",
      problem: "must differ from MEDUSA_JWT_SECRET",
    });
  }

  if (!isHttpsOrigin(env.STOREFRONT_ORIGIN)) {
    issues.push({ variable: "STOREFRONT_ORIGIN", problem: "must be an https origin in production" });
  }

  if (!isHttpsOrigin(env.ADMIN_ORIGIN)) {
    issues.push({ variable: "ADMIN_ORIGIN", problem: "must be an https origin in production" });
  }

  if (env.OTP_DEV_ECHO === "true") {
    issues.push({
      variable: "OTP_DEV_ECHO",
      problem: "must not be enabled in production (it returns OTP codes in the API response)",
    });
  }

  // Payment Mode Protection: Production must NOT use test keys or placeholders
  if (env.RAZORPAY_KEY_ID) {
    if (env.RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
      issues.push({
        variable: "RAZORPAY_KEY_ID",
        problem: "test keys (rzp_test_*) are strictly forbidden in production mode",
      });
    } else if (env.RAZORPAY_KEY_ID.includes("PROD_KEY_ID") || env.RAZORPAY_KEY_ID === "rzp_live_PROD_KEY_ID") {
      issues.push({
        variable: "RAZORPAY_KEY_ID",
        problem: "contains unconfigured template placeholder",
      });
    } else if (!env.RAZORPAY_KEY_ID.startsWith("rzp_live_")) {
      issues.push({
        variable: "RAZORPAY_KEY_ID",
        problem: "must be a live key starting with 'rzp_live_' in production",
      });
    }
  }

  if (env.RAZORPAY_KEY_SECRET && env.RAZORPAY_KEY_SECRET.includes("PROD_RAZORPAY")) {
    issues.push({
      variable: "RAZORPAY_KEY_SECRET",
      problem: "contains unconfigured template placeholder",
    });
  }

  if (env.SHIPROCKET_PASSWORD && env.SHIPROCKET_PASSWORD === "PROD_SHIPROCKET_PASSWORD") {
    issues.push({
      variable: "SHIPROCKET_PASSWORD",
      problem: "contains unconfigured template placeholder",
    });
  }

  return issues;
}

/**
 * Validates staging, development, and test environments.
 * Staging MUST NEVER initiate live payments or use production keys.
 */
export function validateNonProductionEnv(env: Record<string, string | undefined>): EnvIssue[] {
  const issues: EnvIssue[] = [];

  if (env.RAZORPAY_KEY_ID?.startsWith("rzp_live_")) {
    issues.push({
      variable: "RAZORPAY_KEY_ID",
      problem: "live Razorpay keys (rzp_live_*) are strictly forbidden in non-production environments to prevent accidental real charges",
    });
  }

  return issues;
}

/** Throws on boot in production when mandatory secrets are missing or unsafe. */
export function assertProductionEnv(env: Record<string, string | undefined>): void {
  const issues = validateProductionEnv(env);
  if (issues.length === 0) return;

  const detail = issues.map((issue) => `  - ${issue.variable} ${issue.problem}`).join("\n");
  throw new Error(
    `Refusing to start in production with unsafe configuration:\n${detail}\n` +
      "Set these values in the host's secret store. Development defaults and placeholders are deliberately rejected.",
  );
}

/** Throws on boot in non-production when live credentials are accidentally supplied. */
export function assertNonProductionEnv(env: Record<string, string | undefined>): void {
  const issues = validateNonProductionEnv(env);
  if (issues.length === 0) return;

  const detail = issues.map((issue) => `  - ${issue.variable} ${issue.problem}`).join("\n");
  throw new Error(
    `Refusing to start in non-production with live credentials:\n${detail}\n` +
      "Staging and development must use test/sandbox credentials only.",
  );
}
