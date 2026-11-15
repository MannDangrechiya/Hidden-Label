import { notFound } from "next/navigation";
import { fetchCmsPage } from "@/lib/medusa";
import { CmsPageRenderer } from "@/components/cms-page-renderer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Size & Sizing Guide — The Hidden Label",
  description: "International sizing charts for footwear and apparel with measuring instructions.",
};

export default async function SizeGuidePage() {
  const page = await fetchCmsPage("size-guide");
  if (!page) notFound();

  return <CmsPageRenderer page={page} />;
}
