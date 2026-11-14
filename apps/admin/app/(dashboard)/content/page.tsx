import type { Metadata } from "next";
import Link from "next/link";
import { Button, EmptyState, ErrorState, StatusChip, Table } from "@thl/ui";
import { fetchCmsPages } from "../../../lib/api/cms";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Content & CMS" };

/** A-14 — Content / CMS Management: homepage banners, drops, editorial pages. */
export default async function ContentPage() {
  let pages;
  try {
    pages = await fetchCmsPages();
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load content pages.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-headline-lg">Content &amp; CMS</h1>
        <Link href="/content/new">
          <Button>New page</Button>
        </Link>
      </div>

      {pages.length === 0 ? (
        <EmptyState
          title="No content pages yet"
          description="Create the homepage banner or an editorial page."
          action={
            <Link href="/content/new">
              <Button variant="secondary">New page</Button>
            </Link>
          }
        />
      ) : (
        <Table
          columns={[
            {
              key: "title",
              header: "Title",
              sticky: true,
              render: (p) => (
                <Link href={`/content/${p.id}`} className="text-ink underline">
                  {p.title}
                </Link>
              ),
            },
            { key: "slug", header: "Slug", render: (p) => p.slug },
            { key: "kind", header: "Kind", render: (p) => p.kind },
            {
              key: "status",
              header: "Status",
              render: (p) => (
                <StatusChip tone={p.is_published ? "positive" : "neutral"}>
                  {p.is_published ? "Published" : "Draft"}
                </StatusChip>
              ),
            },
            {
              key: "updated_at",
              header: "Updated",
              render: (p) => new Date(p.updated_at).toLocaleDateString("en-IN"),
            },
          ]}
          rows={pages}
          rowKey={(p) => p.id}
        />
      )}
    </div>
  );
}
