import { ErrorState } from "@thl/ui";
import { redirect } from "next/navigation";
import { fetchProducts, MedusaError, type StoreProduct } from "@/lib/medusa";
import { CatalogClient } from "../all/catalog-client";
import { CATEGORIES, type CategoryKey } from "@/lib/catalog";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ size?: string; page?: string }>;
}

function resolveCategory(handle: string): CategoryKey {
  const h = handle.toLowerCase();
  if (h === "all") return "all";
  if (h === "footwear" || h === "sneakers" || h === "shoes") return "footwear";
  if (h === "bespoke" || h === "custom" || h === "custom-bespoke") return "bespoke";
  if (h === "menswear" || h === "men") return "menswear";
  if (h === "womenswear" || h === "women") return "womenswear";
  if (h === "accessories" || h === "bags" || h === "eyewear") return "accessories";
  return "all";
}

export async function generateMetadata({ params }: PageProps) {
  const { handle } = await params;
  const cat = resolveCategory(handle);
  const label = CATEGORIES.find((c) => c.key === cat)?.label ?? handle.toUpperCase();
  return {
    title: `${label} Collection — The Hidden Label`,
    description: `Curated ${label} collection with real-time size valuation in INR.`,
  };
}

export default async function CollectionHandlePage({ params, searchParams }: PageProps) {
  const { handle } = await params;
  if (handle === "all") redirect("/collections/all");

  const { size, page } = await searchParams;
  const PAGE_SIZE = 24;
  const currentPage = Math.max(1, Number(page || 1));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const initialCategory = resolveCategory(handle);
  const categoryLabel = CATEGORIES.find((c) => c.key === initialCategory)?.label ?? handle;

  let products: StoreProduct[] = [];
  let totalCount = 0;
  let totalPages = 1;
  let error: string | null = null;

  try {
    const data = await fetchProducts({ limit: PAGE_SIZE, offset });
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
            The Vault / {categoryLabel}
          </span>
        </div>
        <h1 className="font-display text-headline-xl uppercase text-ink">{categoryLabel}</h1>
        <p className="font-sans text-xs text-muted max-w-2xl">
          Curated selection of {categoryLabel.toLowerCase()} available for nationwide dispatch or boutique collection at Sindhu Bhavan Road, Ahmedabad.
        </p>
      </header>

      {error ? (
        <ErrorState title="Could not load the catalogue" message={error} />
      ) : (
        <CatalogClient
          initialProducts={products}
          initialSizeFilter={size}
          initialCategory={initialCategory}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          basePath={`/collections/${handle}`}
        />
      )}
    </main>
  );
}
