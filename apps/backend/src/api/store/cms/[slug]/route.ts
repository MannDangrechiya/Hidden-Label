import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/** GET /store/cms/:slug — published page only. Drafts are a 404, never a preview. */
export async function GET(
  req: MedusaRequest & { params: { slug: string } },
  res: MedusaResponse,
) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const page = await pg("cms_page")
    .where({ slug: req.params.slug, is_published: true })
    .whereNull("deleted_at")
    .first("slug", "kind", "title", "body_md", "blocks", "seo_title", "seo_description", "published_at");

  if (!page) {
    res.status(404).json({ type: "not_found", message: "Page not found." });
    return;
  }

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json({ page });
}
