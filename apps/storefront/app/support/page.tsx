import { notFound } from "next/navigation";
import { fetchCmsPage } from "@/lib/medusa";
import { CmsPageRenderer } from "@/components/cms-page-renderer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support & Client Services — The Hidden Label",
  description: "Contact client support, track orders, and view FAQ assistance.",
};

export default async function SupportPage() {
  const page = await fetchCmsPage("support");
  if (!page) notFound();

  return <CmsPageRenderer page={page} />;
}
