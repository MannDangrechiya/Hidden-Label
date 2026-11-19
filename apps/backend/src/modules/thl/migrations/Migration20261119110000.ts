import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * MF-29: reverse-inspection grading on a received return — resellable/damaged/disposed — plus
 * when (and whether) it was actually restocked. Previously `receive` only flipped a status with
 * no record of the unit's condition or any effect on inventory.
 */
export class Migration20261119110000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "return_request" add column if not exists "condition" text null;`);
    this.addSql(`alter table "return_request" add column if not exists "condition_note" text null;`);
    this.addSql(
      `alter table "return_request" add column if not exists "restocked_at" timestamptz null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "return_request" drop column if exists "restocked_at";`);
    this.addSql(`alter table "return_request" drop column if exists "condition_note";`);
    this.addSql(`alter table "return_request" drop column if exists "condition";`);
  }
}
