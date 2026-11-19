import { notFound } from "next/navigation";
import { CmsPageRenderer } from "@/components/cms-page-renderer";
import { fetchCmsPage } from "@/lib/medusa";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

/**
 * MF-32: generic CMS page renderer. Next.js only reaches this catch-all for a path no other
 * route claims (a literal page like `/about` or a dynamic one like `/policies/[slug]` always
 * wins first), so any CMS page at any depth — `/guides/sizing/footwear`, not just a single
 * hardcoded segment — resolves here instead of 404ing.
 */
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchCmsPage(slug.join("/"));
  return { title: page ? `${page.title} — The Hidden Label` : "Page not found" };
}

export default async function GenericCmsPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchCmsPage(slug.join("/"));
  if (!page) notFound();

  return <CmsPageRenderer page={page} />;
}
