import { notFound } from "next/navigation";
import { fetchCmsPage } from "@/lib/medusa";
import { CmsPageRenderer } from "@/components/cms-page-renderer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "About The House — The Hidden Label",
  description: "Learn about The Hidden Label luxury house and Sindhu Bhavan flagship boutique.",
};

export default async function AboutPage() {
  const page = await fetchCmsPage("about");
  if (!page) notFound();

  return <CmsPageRenderer page={page} />;
}
