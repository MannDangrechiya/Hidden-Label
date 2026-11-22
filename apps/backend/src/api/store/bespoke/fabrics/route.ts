import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * GET /store/bespoke/fabrics — Public catalog of available luxury fabric swatches (Phase 7).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const fabrics = await pg("fabric_swatch")
    .where({ is_available: true })
    .orderBy("surcharge_rupees", "asc")
    .select(
      "id",
      "name",
      "code",
      "mill",
      "composition",
      "weight_gsm",
      "color",
      "image_url",
      "surcharge_tier",
      "surcharge_rupees",
    );

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.json({ fabrics });
}
