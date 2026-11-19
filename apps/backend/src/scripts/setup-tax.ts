import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { ensureIndiaTaxSetup } from "../lib/tax";

/**
 * `medusa exec ./src/scripts/setup-tax.ts`
 *
 * Unlike `seed.ts` this is safe to run against a real store: it only ensures the India tax
 * region and the four GST slabs exist. Run it once after migrations on every environment
 * (local, staging, production) — GAP-TAX-01.
 */
export default async function setupTax({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const result = await ensureIndiaTaxSetup(pg);

  logger.info(
    `India tax region ${result.regionId} ready. Created: ${
      result.createdRates.join(", ") || "none"
    }. Existing: ${result.existingRates.join(", ") || "none"}.`,
  );
}
