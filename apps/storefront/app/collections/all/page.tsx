import Link from "next/link";
import { ErrorState } from "@thl/ui";
import {
  fetchCategories,
  fetchProducts,
  findCategoryByHandle,
  MedusaError,
  type StoreProduct,
} from "@/lib/medusa";
import { CatalogClient } from "./catalog-client";
import { resaleEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Vault Catalogue — Curated Footwear & Apparel | The Hidden Label",
  description: "Browse multi-brand footwear, apparel and made-to-measure tailoring from The Hidden Label.",
};

interface PageProps {
  searchParams: Promise<{ size?: string; category?: string; page?: string }>;
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const { size, category, page } = await searchParams;
  const resaleOn = resaleEnabled();
  const PAGE_SIZE = 24;
  const currentPage = Math.max(1, Number(page || 1));
  const offset = (currentPage - 1) * PAGE_SIZE;

  let products: StoreProduct[] = [];
  let totalCount = 0;
  let totalPages = 1;
  let error: string | null = null;
  let activeCategoryName: string | null = null;

  try {
    let categoryId: string | undefined;
    if (category) {
      const tree = await fetchCategories();
      const node = findCategoryByHandle(tree, category);
      categoryId = node?.id;
      activeCategoryName = node?.name ?? null;
    }
    const data = await fetchProducts({ limit: PAGE_SIZE, offset, categoryId });
    products = data.products;
    totalCount = data.count ?? products.length;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  } catch (caught) {
    error =
      caught instanceof MedusaError
        ? caught.message
        : `Unexpected error: ${caught instanceof Error ? caught.message : String(caught)}`;
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-8 flex flex-col gap-2 border-b border-line pb-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-label-caps uppercase text-muted">
            {resaleOn ? "Secondary Marketplace Orderbook" : "The Vault"}
          </span>
        </div>
        <h1 className="font-display text-headline-xl uppercase text-ink">The Vault Catalogue</h1>
        <p className="font-sans text-xs text-muted max-w-2xl">
          {/* D2: no blanket authentication claim — only a unit with a real, approved inspection
              record shows an authentication badge on its own product page. */}
          {resaleOn
            ? "Buy immediately at the lowest ask, or place a size-specific bid. Units with a completed lab inspection show their authentication report on the product page."
            : "Multi-brand footwear, apparel and made-to-measure tailoring — live size availability, dispatched nationwide from our Ahmedabad boutique."}
        </p>
        {activeCategoryName ? (
          <p className="font-mono text-label-caps uppercase text-ink">
            Category: {activeCategoryName}{" "}
            <Link href="/collections/all" className="text-muted no-underline hover:text-ink hover:underline">
              (clear)
            </Link>
          </p>
        ) : null}
      </header>

      {error ? (
        <ErrorState title="Could not load the catalogue" message={error} />
      ) : (
        <CatalogClient
          initialProducts={products}
          initialSizeFilter={size}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/collections/all"
        />
      )}
    </main>
  );
}
