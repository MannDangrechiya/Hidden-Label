import knex, { Knex } from "knex";

/**
 * scripts/clean-test-fixtures.ts
 *
 * Safely purges test fixtures created during automated audits (e.g., "Audit Brand...", "TestBrand...")
 * with strict safety preconditions and catalogue protection guards.
 *
 * SAFETY PROTOCOLS:
 * 1. Refuses execution in NODE_ENV=production.
 * 2. Refuses execution against production database URLs or hostnames.
 * 3. Requires explicit confirmation: --confirm-environment=(test|development|staging).
 * 4. Strictly protects real catalogue data: NO --force bypass exists. If any linked products exist,
 *    deletion is refused outright.
 * 5. Dry-run by default. Mutation requires explicit --execute.
 * 6. Atomic transactional execution with rollback on error.
 *
 * Usage:
 *   npx ts-node scripts/clean-test-fixtures.ts                                     # Dry run
 *   npx ts-node scripts/clean-test-fixtures.ts --execute --confirm-environment=test # Execute in test
 */

export interface PreconditionCheckResult {
  allowed: boolean;
  isExecute: boolean;
  environment?: string;
  error?: string;
}

export function validateSafetyPreconditions(
  env: { nodeEnv?: string; databaseUrl?: string },
  args: string[]
): PreconditionCheckResult {
  const nodeEnv = (env.nodeEnv || "").toLowerCase().trim();
  const databaseUrl = (env.databaseUrl || "").toLowerCase().trim();
  const isExecute = args.includes("--execute");

  // 1. Refuse execution when NODE_ENV is production
  if (nodeEnv === "production") {
    return {
      allowed: false,
      isExecute,
      error: "CRITICAL REFUSAL: Test fixture cleanup is strictly forbidden in NODE_ENV=production.",
    };
  }

  // 2. Refuse execution against production database hostnames or connection strings
  const productionIndicators = [
    "production",
    "prod.internal",
    "thehiddenlabel.com",
    "rds.amazonaws.com",
  ];

  for (const indicator of productionIndicators) {
    if (databaseUrl.includes(indicator) && !databaseUrl.includes("test")) {
      return {
        allowed: false,
        isExecute,
        error: `CRITICAL REFUSAL: DATABASE_URL appears to target production infrastructure (${indicator}). Aborting.`,
      };
    }
  }

  // 3. Reject any attempt to use --force
  if (args.includes("--force")) {
    return {
      allowed: false,
      isExecute,
      error: "CRITICAL REFUSAL: The --force flag has been decommissioned to prevent accidental catalogue destruction.",
    };
  }

  // 4. If --execute is passed, require explicit --confirm-environment flag
  if (isExecute) {
    const confirmArg = args.find((a) => a.startsWith("--confirm-environment="));
    if (!confirmArg) {
      return {
        allowed: false,
        isExecute,
        error: "CRITICAL REFUSAL: Mutation requires explicit --confirm-environment=<env> where <env> is test, development, or staging.",
      };
    }

    const confirmedEnv = confirmArg.split("=")[1]?.toLowerCase().trim();
    const validEnvs = ["test", "development", "staging"];

    if (!validEnvs.includes(confirmedEnv)) {
      return {
        allowed: false,
        isExecute,
        error: `CRITICAL REFUSAL: Invalid environment '${confirmedEnv}'. Must be one of: ${validEnvs.join(", ")}. 'production' is strictly disallowed.`,
      };
    }

    return { allowed: true, isExecute: true, environment: confirmedEnv };
  }

  // Dry run is allowed by default
  return { allowed: true, isExecute: false };
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
      console.log("To execute deletion in a non-production environment, run:");
      console.log("  npx ts-node scripts/clean-test-fixtures.ts --execute --confirm-environment=test\n");
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
