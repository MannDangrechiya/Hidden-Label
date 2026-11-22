import knex, { Knex } from "knex";

/**
 * scripts/clean-test-fixtures.ts
 *
 * Safely purges test fixtures created during automated audits (e.g., "Audit Brand...", "TestBrand...")
 * with strict safety preconditions, environment matching, and catalogue protection guards.
 *
 * SAFETY PROTOCOLS:
 * 1. Strict Fail-Closed Environment Validation:
 *    - Refuses execution if NODE_ENV=production or undefined.
 *    - NODE_ENV must be explicitly one of: 'development', 'test', 'staging'.
 *    - Mutation (--execute) requires --confirm-environment=<env> matching NODE_ENV exactly.
 * 2. Multi-Layer Database Target Verification:
 *    - Rejects known production database hostnames and patterns.
 *    - Rejects known production database names (e.g., contains 'prod' or 'production').
 *    - Enforces explicit authorized database host allowlist for destructive execution.
 *    - Rejects malformed connection strings.
 * 3. Zero Credential Exposure in Logs & Errors:
 *    - Passwords and auth tokens are sanitized from all output.
 * 4. Catalogue & Product Shield:
 *    - The --force flag is permanently decommissioned.
 *    - If any target brand is linked to an existing product in product_brand, deletion is refused outright.
 * 5. Dry-run by default. Mutation requires explicit --execute and matching --confirm-environment.
 * 6. Atomic transactional execution with rollback on error.
 *
 * Usage:
 *   NODE_ENV=test npx ts-node scripts/clean-test-fixtures.ts                                     # Dry run
 *   NODE_ENV=test npx ts-node scripts/clean-test-fixtures.ts --execute --confirm-environment=test # Execution
 */

export interface PreconditionCheckResult {
  allowed: boolean;
  isExecute: boolean;
  environment?: string;
  error?: string;
  targetInfo?: { host: string; database: string };
}

export const SAFE_HOST_ALLOWLIST = [
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
  "thl-postgres",
  "thl-postgres-test",
  "thl-postgres-staging",
  "test-postgres",
];

export const SAFE_ENV_ALLOWLIST = ["development", "test", "staging"];

/**
 * Strips credentials from connection string for safe reporting.
 */
export function sanitizeDatabaseUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return "[MALFORMED DATABASE URL]";
  }
}

export function validateSafetyPreconditions(
  env: { nodeEnv?: string; databaseUrl?: string },
  args: string[]
): PreconditionCheckResult {
  const nodeEnv = (env.nodeEnv || "").toLowerCase().trim();
  const rawDbUrl = (env.databaseUrl || "").trim();
  const isExecute = args.includes("--execute");

  // 1. Strict Fail-Closed Check on NODE_ENV
  if (!nodeEnv || !SAFE_ENV_ALLOWLIST.includes(nodeEnv)) {
    if (nodeEnv === "production") {
      return {
        allowed: false,
        isExecute,
        error: "CRITICAL REFUSAL: Test fixture cleanup is strictly forbidden in NODE_ENV=production.",
      };
    }
    return {
      allowed: false,
      isExecute,
      error: `CRITICAL REFUSAL: Cannot establish safe non-production environment. NODE_ENV must be explicitly one of: ${SAFE_ENV_ALLOWLIST.join(", ")} (current: '${nodeEnv || "undefined"}').`,
    };
  }

  // 2. Reject the decommissioned --force flag
  if (args.includes("--force")) {
    return {
      allowed: false,
      isExecute,
      error: "CRITICAL REFUSAL: The --force flag has been permanently decommissioned to prevent accidental catalogue destruction.",
    };
  }

  // 3. Database URL Parsing & Multi-Layer Safety Validation
  if (!rawDbUrl) {
    return {
      allowed: false,
      isExecute,
      error: "CRITICAL REFUSAL: DATABASE_URL is missing or empty. Cannot verify target database safely.",
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawDbUrl);
    if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return {
      allowed: false,
      isExecute,
      error: "CRITICAL REFUSAL: Malformed DATABASE_URL. Target database connection string cannot be safely validated.",
    };
  }

  const host = parsedUrl.hostname.toLowerCase();
  const dbName = parsedUrl.pathname.replace(/^\//, "").toLowerCase();

  // 3a. Check for known production host indicators
  const productionHostIndicators = [
    "production",
    "prod.internal",
    "thehiddenlabel.com",
    "rds.amazonaws.com",
    "cloudsql",
  ];

  for (const indicator of productionHostIndicators) {
    if (host.includes(indicator)) {
      return {
        allowed: false,
        isExecute,
        error: `CRITICAL REFUSAL: Target database host appears to target production infrastructure (${indicator}). Aborting.`,
      };
    }
  }

  // 3b. Check for production database name indicators
  if (dbName.includes("prod") || dbName.includes("production")) {
    return {
      allowed: false,
      isExecute,
      error: `CRITICAL REFUSAL: Target database name '${dbName}' indicates production infrastructure. Aborting.`,
    };
  }

  // 3c. Host allowlist verification for mutation (--execute)
  if (isExecute && !SAFE_HOST_ALLOWLIST.includes(host)) {
    return {
      allowed: false,
      isExecute,
      error: `CRITICAL REFUSAL: Host '${host}' is not on the authorized non-production database allowlist. Execution blocked.`,
    };
  }

  // 4. Exact Environment Matching for Mutation (--execute)
  if (isExecute) {
    const confirmArg = args.find((a) => a.startsWith("--confirm-environment="));
    if (!confirmArg) {
      return {
        allowed: false,
        isExecute,
        error: `CRITICAL REFUSAL: Mutation requires explicit --confirm-environment=${nodeEnv} matching the active NODE_ENV.`,
      };
    }

    const confirmedEnv = confirmArg.split("=")[1]?.toLowerCase().trim();

    if (!confirmedEnv || !SAFE_ENV_ALLOWLIST.includes(confirmedEnv)) {
      return {
        allowed: false,
        isExecute,
        error: `CRITICAL REFUSAL: Invalid environment '${confirmedEnv}'. Must be one of: ${SAFE_ENV_ALLOWLIST.join(", ")}. 'production' is strictly disallowed.`,
      };
    }

    // Must match NODE_ENV exactly
    if (confirmedEnv !== nodeEnv) {
      return {
        allowed: false,
        isExecute,
        error: `CRITICAL REFUSAL: Environment mismatch. NODE_ENV is '${nodeEnv}' but --confirm-environment='${confirmedEnv}'. Arguments must match runtime environment.`,
      };
    }

    return {
      allowed: true,
      isExecute: true,
      environment: confirmedEnv,
      targetInfo: { host, database: dbName },
    };
  }

  // Dry run is allowed by default if safety checks passed
  return {
    allowed: true,
    isExecute: false,
    environment: nodeEnv,
    targetInfo: { host, database: dbName },
  };
}

export async function findTestBrands(db: Knex) {
  return db("brand")
    .where("name", "like", "Audit Brand%")
    .orWhere("name", "like", "TestBrand%")
    .orWhere("handle", "like", "audit-brand%")
    .orWhere("handle", "like", "testbrand%")
    .select("id", "name", "handle");
}

export async function checkLinkedProducts(db: Knex, brandIds: string[]) {
  if (brandIds.length === 0) return 0;
  const result = await db("product_brand")
    .whereIn("brand_id", brandIds)
    .count<{ count: string }[]>("* as count");
  return Number(result[0]?.count || 0);
}

export async function purgeTestBrands(db: Knex, brandIds: string[]): Promise<number> {
  if (brandIds.length === 0) return 0;

  return db.transaction(async (trx) => {
    // Safety double-check inside transaction: verify zero linked products
    const linked = await trx("product_brand")
      .whereIn("brand_id", brandIds)
      .count<{ count: string }[]>("* as count");

    const linkedCount = Number(linked[0]?.count || 0);
    if (linkedCount > 0) {
      throw new Error(
        `TRANSACTION ABORT: ${linkedCount} products are linked to target brands. Deletion rolled back to preserve catalogue data.`
      );
    }

    return trx("brand").whereIn("id", brandIds).delete();
  });
}

export async function main() {
  const databaseUrl =
    process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5437/the_hidden_label";

  const safetyCheck = validateSafetyPreconditions(
    { nodeEnv: process.env.NODE_ENV, databaseUrl },
    process.argv
  );

  if (!safetyCheck.allowed) {
    console.error("\n=============================================================================");
    console.error("SAFETY CHECK FAILED — OPERATION ABORTED");
    console.error(safetyCheck.error);
    console.error("=============================================================================\n");
    process.exit(1);
  }

  const db = knex({ client: "pg", connection: databaseUrl });

  try {
    console.log("=============================================================================");
    console.log("THE HIDDEN LABEL — TEST FIXTURE CLEANUP AUDIT");
    console.log(`Mode: ${safetyCheck.isExecute ? `EXECUTE (Target: ${safetyCheck.environment})` : "DRY RUN (INSPECTION ONLY)"}`);
    console.log(`Database Target: ${safetyCheck.targetInfo?.host}:${safetyCheck.targetInfo?.database}`);
    console.log("=============================================================================\n");

    const testBrands = await findTestBrands(db);
    console.log(`Found ${testBrands.length} test brand fixture(s):`);
    for (const b of testBrands) {
      console.log(`  - [${b.id}] ${b.name} (${b.handle})`);
    }

    if (testBrands.length === 0) {
      console.log("\nNo test fixtures found in database. Clean state confirmed.");
      return;
    }

    const brandIds = testBrands.map((b) => b.id);
    const linkedCount = await checkLinkedProducts(db, brandIds);

    if (linkedCount > 0) {
      console.error(
        `\nCRITICAL SAFETY REFUSAL: ${linkedCount} product(s) linked to test brands.`
      );
      console.error(
        "Refusing to delete brands linked to existing products. Catalogue protection active."
      );
      process.exit(1);
    }

    if (!safetyCheck.isExecute) {
      console.log("\n[DRY RUN COMPLETE] Zero changes made to the database.");
      console.log(`To execute deletion in ${safetyCheck.environment}, run:`);
      console.log(`  NODE_ENV=${safetyCheck.environment} npx ts-node scripts/clean-test-fixtures.ts --execute --confirm-environment=${safetyCheck.environment}\n`);
      return;
    }

    const deleted = await purgeTestBrands(db, brandIds);
    console.log(`\nSuccessfully deleted ${deleted} test brand fixture(s) transactionally.`);
  } finally {
    await db.destroy();
  }
}

// Run main if invoked directly
if (typeof require !== "undefined" && require.main === module) {
  main().catch((err) => {
    console.error("Error during fixture cleanup:", err);
    process.exit(1);
  });
}
