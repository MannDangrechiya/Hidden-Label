import { notFound } from "next/navigation";
import { fetchCmsPage } from "@/lib/medusa";
import { CmsPageRenderer } from "@/components/cms-page-renderer";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchCmsPage(`policies/${slug}`);
  return {
    title: page ? `${page.title} — The Hidden Label` : "Policy",
  };
}

export default async function PolicyPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchCmsPage(`policies/${slug}`);
  if (!page) notFound();

  return <CmsPageRenderer page={page} />;
}
