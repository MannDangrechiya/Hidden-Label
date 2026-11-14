import { ErrorState } from "@thl/ui";
import { fetchProducts, MedusaError, type StoreProduct } from "@/lib/medusa";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Vault Catalogue — Curated Footwear & Streetwear | The Hidden Label",
  description: "Browse multi-brand footwear and streetwear with real-time size valuation in INR.",
};

interface PageProps {
  searchParams: Promise<{ size?: string }>;
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const { size } = await searchParams;
  let products: StoreProduct[] = [];
  let error: string | null = null;

  try {
    const data = await fetchProducts({ limit: 48 });
    products = data.products;
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
            Secondary Marketplace Orderbook
          </span>
        </div>
        <h1 className="font-display text-headline-xl uppercase text-ink">The Vault Catalogue</h1>
        <p className="font-sans text-xs text-muted max-w-2xl">
          {/* D2: no blanket authentication claim — only a unit with a real, approved inspection
              record shows an authentication badge on its own product page. */}
          Buy immediately at the lowest ask, or place a size-specific bid. Units with a completed
          lab inspection show their authentication report on the product page.
        </p>
      </header>

      {error ? (
        <ErrorState title="Could not load the catalogue" message={error} />
      ) : (
        <CatalogClient initialProducts={products} initialSizeFilter={size} />
      )}
    </main>
  );
}
