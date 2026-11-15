import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * GET /store/cms/policies/:slug — multi-segment policy route handler.
 * Resolves pages stored with 'policies/<slug>' (shipping, returns, privacy, terms).
 */
export async function GET(
  req: MedusaRequest & { params: { slug: string } },
  res: MedusaResponse,
) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const fullSlug = `policies/${req.params.slug}`;

  const page = await pg("cms_page")
    .where({ slug: fullSlug, is_published: true })
    .whereNull("deleted_at")
    .first("slug", "kind", "title", "body_md", "blocks", "seo_title", "seo_description", "published_at");

  if (!page) {
    res.status(404).json({ type: "not_found", message: "Policy page not found." });
    return;
  }

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json({ page });
}
