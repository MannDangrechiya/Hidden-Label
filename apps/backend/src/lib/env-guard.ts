/**
 * Production configuration assertions (GAP-116).
 *
 * The backend previously fell back to `local_dev_jwt_secret` / `local_dev_cookie_secret` when
 * the environment file was missing. A production process that lost its env file would boot
 * successfully with publicly known signing keys. This module makes that a startup failure.
 *
 * It reports **variable names and problems only** — never values.
 */

const KNOWN_DEV_SECRETS = new Set([
  "local_dev_jwt_secret",
  "local_dev_cookie_secret",
  "local_dev_jwt_secret_change_me_0123456789abcdef",
  "local_dev_cookie_secret_change_me_0123456789abcdef",
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
  }

  if (isWeakSecret(env.MEDUSA_JWT_SECRET)) {
    issues.push({
      variable: "MEDUSA_JWT_SECRET",
      problem: `must be set to a random value of at least ${MIN_SECRET_LENGTH} characters that is not a development default`,
    });
  }

  if (isWeakSecret(env.MEDUSA_COOKIE_SECRET)) {
    issues.push({
      variable: "MEDUSA_COOKIE_SECRET",
      problem: `must be set to a random value of at least ${MIN_SECRET_LENGTH} characters that is not a development default`,
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

  return issues;
}

/** Throws on the first load in production when mandatory secrets are missing or unsafe. */
export function assertProductionEnv(env: Record<string, string | undefined>): void {
  const issues = validateProductionEnv(env);
  if (issues.length === 0) return;

  const detail = issues.map((issue) => `  - ${issue.variable} ${issue.problem}`).join("\n");
  throw new Error(
    `Refusing to start in production with unsafe configuration:\n${detail}\n` +
      "Set these values in the host's secret store. Development defaults are deliberately rejected.",
  );
}
