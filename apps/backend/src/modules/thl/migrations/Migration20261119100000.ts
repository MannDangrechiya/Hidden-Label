import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Cash on Delivery is not offered, so its verification proof table and the payout-details
 * table that only existed to refund COD orders are removed. Databases created after
 * Migration20261117100000 no longer create them; this drops them where that migration
 * already ran.
 */
export class Migration20261119100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`drop table if exists "cod_verification" cascade;`);
    this.addSql(`drop table if exists "refund_account" cascade;`);
  }

  override async down(): Promise<void> {
    // Intentionally irreversible: these tables back a removed feature.
  }
}
