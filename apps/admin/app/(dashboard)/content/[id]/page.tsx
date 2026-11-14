import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchCmsPage } from "../../../../lib/api/cms";
import { BackendError } from "../../../../lib/backend";
import { EditContentForm } from "./edit-content-form";

export const metadata: Metadata = { title: "Edit page" };

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let page;
  try {
    page = await fetchCmsPage(id);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load this page.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">{page.title}</h1>
      <p className="font-mono text-label-caps uppercase text-muted">/{page.slug}</p>
      <EditContentForm page={page} />
    </div>
  );
}
