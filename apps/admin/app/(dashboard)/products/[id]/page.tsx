import type { Metadata } from "next";
import { ErrorState, StatusChip } from "@thl/ui";
import { fetchProduct } from "../../../../lib/api/products";
import { fetchCurrentAdmin, roleAtLeast } from "../../../../lib/api/auth";
import { BackendError } from "../../../../lib/backend";
import { EditProductForm } from "./edit-product-form";
import { MediaManager } from "./media-manager";
import { PublishControls } from "./publish-controls";
import { VariantsTable } from "./variants-table";

export const metadata: Metadata = { title: "Edit product" };

const STATUS_TONE = {
  draft: "neutral",
  proposed: "warning",
  published: "positive",
  rejected: "critical",
} as const;

/** A-03 — Add Product Flow, edit mode: variant matrix, media, publish checklist. */
export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let product;
  let canWrite = false;
  try {
    [product, canWrite] = await Promise.all([
      fetchProduct(id),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "manager")),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load this product.";
    return <ErrorState message={message} />;
  }

  const checklist = [
    { label: "Has a title", done: Boolean(product.title) },
    { label: "Has at least one variant", done: (product.variants?.length ?? 0) > 0 },
    { label: "Every variant has a price", done: (product.variants ?? []).every((v) => (v.prices?.length ?? 0) > 0) },
    { label: "Has a thumbnail", done: Boolean(product.thumbnail) },
    { label: "Assigned to a category", done: (product.categories?.length ?? 0) > 0 },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-headline-lg">{product.title}</h1>
          <p className="font-mono text-label-caps uppercase text-muted">{product.handle}</p>
        </div>
        <div className="flex items-center gap-4">
          <StatusChip tone={STATUS_TONE[product.status]}>{product.status}</StatusChip>
          {canWrite ? <PublishControls productId={product.id} status={product.status} /> : null}
        </div>
      </div>

      <section className="border border-line bg-surface p-5">
        <h2 className="mb-3 font-display text-headline-sm">Publish checklist</h2>
        <ul className="flex flex-col gap-2">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2 font-sans text-body-sm">
              <span aria-hidden="true">{item.done ? "✓" : "○"}</span>
              <span className={item.done ? "text-on-surface" : "text-muted"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-headline-sm">Details</h2>
          <EditProductForm product={product} canWrite={canWrite} />
        </div>
        <div>
          <h2 className="mb-3 font-display text-headline-sm">Media</h2>
          <MediaManager product={product} canWrite={canWrite} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm">Variants &amp; pricing</h2>
        <VariantsTable productId={product.id} variants={product.variants ?? []} canWrite={canWrite} />
      </section>
    </div>
  );
}
