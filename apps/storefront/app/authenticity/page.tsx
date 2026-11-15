import { notFound } from "next/navigation";
import { fetchCmsPage } from "@/lib/medusa";
import { CmsPageRenderer } from "@/components/cms-page-renderer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Authenticity & Physical Inspection Protocol — The Hidden Label",
  description: "Our physical verification and inspection standards for luxury fashion and footwear.",
};

export default async function AuthenticityPage() {
  const page = await fetchCmsPage("authenticity");
  if (!page) notFound();

  return <CmsPageRenderer page={page} />;
}
