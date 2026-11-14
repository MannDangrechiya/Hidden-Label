import "server-only";
import { backendFetch } from "../backend";

export type CmsKind = "page" | "policy" | "faq" | "banner" | "drop";

export interface CmsPageSummary {
  id: string;
  slug: string;
  kind: CmsKind;
  title: string;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
}

export interface CmsPage extends CmsPageSummary {
  body_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  blocks: unknown[];
}

export interface CmsPageInput {
  slug?: string;
  kind?: CmsKind;
  title?: string;
  body_md?: string | null;
  is_published?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
}

/** GET /admin/cms — backs A-14 (homepage banners & CMS content). */
export async function fetchCmsPages(): Promise<CmsPageSummary[]> {
  const { pages } = await backendFetch<{ pages: CmsPageSummary[] }>("/admin/cms");
  return pages;
}

export async function fetchCmsPage(id: string): Promise<CmsPage> {
  const { page } = await backendFetch<{ page: CmsPage }>(`/admin/cms/${id}`);
  return page;
}

export async function createCmsPage(input: CmsPageInput): Promise<CmsPage> {
  const { page } = await backendFetch<{ page: CmsPage }>("/admin/cms", {
    method: "POST",
    body: input,
  });
  return page;
}

export async function updateCmsPage(id: string, input: CmsPageInput): Promise<CmsPage> {
  const { page } = await backendFetch<{ page: CmsPage }>(`/admin/cms/${id}`, {
    method: "PATCH",
    body: input,
  });
  return page;
}
