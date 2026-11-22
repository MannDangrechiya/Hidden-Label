import knex from "knex";

/**
 * scripts/clean-test-fixtures.ts (BUG-12 / FINDING-08)
 *
 * Safely purges test fixtures created during automated audits (e.g., "Audit Brand...", "TestBrand...")
 * while strictly protecting real catalogue data.
 *
 * Usage:
 *   npx ts-node scripts/clean-test-fixtures.ts          # Dry run (default)
 *   npx ts-node scripts/clean-test-fixtures.ts --execute # Performs deletion
 */

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5437/the_hidden_label";

async function main() {
  const isExecute = process.argv.includes("--execute");
  const db = knex({ client: "pg", connection: DATABASE_URL });

  try {
    console.log("=============================================================================");
    console.log("THE HIDDEN LABEL — TEST FIXTURE CLEANUP AUDIT");
    console.log(`Mode: ${isExecute ? "EXECUTE (MUTATION)" : "DRY RUN (INSPECTION ONLY)"}`);
    console.log("=============================================================================\n");

    // Locate test brands created by audits
    const testBrands = await db("brand")
      .where("name", "like", "Audit Brand%")
      .orWhere("name", "like", "TestBrand%")
      .orWhere("handle", "like", "audit-brand%")
      .orWhere("handle", "like", "testbrand%")
      .select("id", "name", "handle");

    console.log(`Found ${testBrands.length} test brand fixture(s):`);
    for (const b of testBrands) {
      console.log(`  - [${b.id}] ${b.name} (${b.handle})`);
    }

    if (testBrands.length === 0) {
      console.log("\nNo test fixtures found in database. Clean state confirmed.");
      return;
    }

    // Verify none of these test brands are linked to active products
    const brandIds = testBrands.map((b) => b.id);
    const linkedProducts = await db("product_brand")
      .whereIn("brand_id", brandIds)
      .count<{ count: string }[]>("* as count");

    const linkedCount = Number(linkedProducts[0]?.count || 0);
    if (linkedCount > 0) {
      console.warn(`\nWARNING: ${linkedCount} product(s) linked to these test brands.`);
      if (!process.argv.includes("--force")) {
        console.error("Refusing to delete brands with linked products without --force.");
        return;
      }
    }

    if (!isExecute) {
      console.log("\n[DRY RUN] Run with '--execute' to remove these records safely.");
      return;
    }

    // Perform atomic deletion inside transaction
    await db.transaction(async (trx) => {
      await trx("product_brand").whereIn("brand_id", brandIds).delete();
      const deleted = await trx("brand").whereIn("id", brandIds).delete();
      console.log(`\nSuccessfully deleted ${deleted} test brand fixture(s).`);
    });
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error("Error during fixture cleanup:", err);
  process.exit(1);
});
