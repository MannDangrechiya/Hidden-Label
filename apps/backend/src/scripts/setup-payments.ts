import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";

/**
 * `medusa exec ./src/scripts/setup-payments.ts` — prepaid-only payment configuration.
 *
 * The business offers UPI and cards through Razorpay and does not offer Cash on Delivery.
 * This idempotently:
 *   1. removes `pp_system_default` (COD) from the INR region, so the store API can never list
 *      it and no COD order can be created;
 *   2. links `pp_razorpay_razorpay` once `RAZORPAY_KEY_ID` exists.
 *
 * Safe to run on every environment, including production. `db:seed` creates the region with
 * the same rule; this script fixes regions that already exist.
 */
export default async function setupPayments({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const region = await pg("region")
    .where({ currency_code: "inr" })
    .whereNull("deleted_at")
    .first("id", "name");

  if (!region) {
    logger.warn("No INR region found. Run `pnpm db:seed` first.");
    return;
  }

  const removed = await pg("region_payment_provider")
    .where({ region_id: region.id })
    .whereIn("payment_provider_id", ["pp_system_default"])
    .del();

  let razorpayLinked = false;
  const existing = await pg("region_payment_provider")
    .where({ region_id: region.id, payment_provider_id: "pp_razorpay_razorpay" })
    .first("id");

  if (process.env.RAZORPAY_KEY_ID && !existing) {
    await pg("region_payment_provider").insert({
      id: generateEntityId(undefined, "rpp"),
      region_id: region.id,
      payment_provider_id: "pp_razorpay_razorpay",
    });
    razorpayLinked = true;
  }

  const final = (await pg("region_payment_provider")
    .where({ region_id: region.id })
    .select("payment_provider_id")) as { payment_provider_id: string }[];

  logger.info(
    `Payments for region ${region.name ?? region.id}: COD links removed=${removed}, ` +
      `Razorpay ${razorpayLinked ? "linked now" : existing ? "already linked" : "not linked (set RAZORPAY_KEY_ID)"}. ` +
      `Active providers: ${final.map((row) => row.payment_provider_id).join(", ") || "none"}.`,
  );
}
