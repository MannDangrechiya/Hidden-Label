import type { Metadata } from "next";
import Link from "next/link";
import { Button, EmptyState, ErrorState, StatusChip, Table } from "@thl/ui";
import { fetchProducts, type ProductStatus } from "../../../lib/api/products";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Products" };

const STATUS_TONE: Record<ProductStatus, "neutral" | "positive" | "warning" | "critical"> = {
  draft: "neutral",
  proposed: "warning",
  published: "positive",
  rejected: "critical",
};

const LIMIT = 20;

/** A-02 — Product Management List. */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; offset?: string }>;
}) {
  const { q, status, offset: offsetRaw } = await searchParams;
  const offset = Number(offsetRaw ?? 0) || 0;

  let result;
  try {
    result = await fetchProducts({
      q,
      offset,
      limit: LIMIT,
      status: status ? [status as ProductStatus] : undefined,
    });
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load products.";
    return <ErrorState message={message} />;
  }

  const stockOf = (product: (typeof result.products)[number]) =>
    (product.variants ?? []).reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0);

  const query = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (offset) params.set("offset", String(offset));
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-headline-lg">Products</h1>
        <Link href="/products/new">
          <Button>Add product</Button>
        </Link>
      </div>

      <form action="/products" className="flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search title or SKU"
          className="min-w-[240px] border border-line bg-surface px-3 py-2 font-sans text-body-sm outline-none focus:border-ink"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-line bg-surface px-3 py-2 font-sans text-body-sm outline-none focus:border-ink"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="proposed">Proposed</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {result.products.length === 0 ? (
        <EmptyState
          title="No products match this filter"
          description="Try clearing the search or status filter, or add the first product."
          action={
            <Link href="/products/new">
              <Button variant="secondary">Add product</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Table
            columns={[
              {
                key: "title",
                header: "Product",
                sticky: true,
                render: (p) => (
                  <Link href={`/products/${p.id}`} className="text-ink underline">
                    {p.title}
                  </Link>
                ),
              },
              { key: "handle", header: "Handle", render: (p) => p.handle },
              {
                key: "status",
                header: "Status",
                render: (p) => <StatusChip tone={STATUS_TONE[p.status]}>{p.status}</StatusChip>,
              },
              { key: "variants", header: "Variants", render: (p) => p.variants?.length ?? 0, align: "right" },
              { key: "stock", header: "Stock", render: (p) => stockOf(p), align: "right" },
              {
                key: "categories",
                header: "Categories",
                render: (p) => p.categories?.map((c) => c.name).join(", ") || "—",
              },
            ]}
            rows={result.products}
            rowKey={(p) => p.id}
          />

          <div className="flex items-center justify-between">
            <p className="font-mono text-label-caps uppercase text-muted">
              {offset + 1}–{Math.min(offset + LIMIT, result.count)} of {result.count}
            </p>
            <div className="flex gap-3">
              <Link
                href={query({ offset: String(Math.max(0, offset - LIMIT)) })}
                aria-disabled={offset === 0}
                className={`font-mono text-label-caps uppercase ${offset === 0 ? "pointer-events-none text-line" : "text-ink underline"}`}
              >
                Previous
              </Link>
              <Link
                href={query({ offset: String(offset + LIMIT) })}
                aria-disabled={offset + LIMIT >= result.count}
                className={`font-mono text-label-caps uppercase ${offset + LIMIT >= result.count ? "pointer-events-none text-line" : "text-ink underline"}`}
              >
                Next
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
