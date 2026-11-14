import { moneyFromRupees } from "@thl/shared";
import { EmptyState, ErrorState, LoadMore, ProductCard } from "@thl/ui";
import Link from "next/link";
import { fetchProducts, MedusaError, type StoreProduct } from "@/lib/medusa";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

const PAGE_SIZE = 24;

export async function generateMetadata({ searchParams }: PageProps) {
  const { q } = await searchParams;
  return { title: q ? `"${q}"` : "Search" };
}

function priceOf(product: StoreProduct) {
  const amount = product.variants?.[0]?.calculated_price?.calculated_amount;
  return amount === null || amount === undefined ? null : moneyFromRupees(amount);
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q, offset: offsetParam } = await searchParams;
  const query = (q ?? "").trim();
  const offset = Math.max(Number(offsetParam ?? 0) || 0, 0);

  let products: StoreProduct[] = [];
  let count = 0;
  let error: string | null = null;

  if (query) {
    try {
      const data = await fetchProducts({ q: query, limit: PAGE_SIZE, offset });
      products = data.products;
      count = data.count;
    } catch (caught) {
      error =
        caught instanceof MedusaError
          ? caught.message
          : `Unexpected error: ${caught instanceof Error ? caught.message : String(caught)}`;
    }
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-col gap-2 border-b border-line pb-sp-3">
        <h1 className="type-headline-lg uppercase">
          {query ? `Results for "${query}"` : "Search"}
        </h1>
        {query && !error ? (
          <p className="font-mono text-label-caps uppercase text-muted">
            {count} matched pair{count === 1 ? "" : "s"}
          </p>
        ) : null}
      </header>

      {!query ? (
        <EmptyState
          title="Search the catalogue"
          description="Use the search icon in the header, or try a brand, product or SKU here."
        />
      ) : error ? (
        <ErrorState title="Search is unavailable" message={error} />
      ) : products.length === 0 ? (
        <EmptyState
          title={`No matches for "${query}"`}
          description="Check the spelling, try a shorter term, or browse the full catalogue instead."
          action={
            <Link
              href="/collections/all"
              className="inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
            >
              Shop all
            </Link>
          }
        />
      ) : (
        <>
          <ul className="grid list-none grid-cols-2 gap-gutter p-0 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard
                  brand={typeof product.metadata?.brand === "string" ? product.metadata.brand : null}
                  title={product.title}
                  price={priceOf(product)}
                  imageUrl={product.thumbnail}
                  href={`/products/${product.handle}`}
                />
              </li>
            ))}
          </ul>

          <LoadMore
            shown={Math.min(offset + products.length, count)}
            total={count}
            hasMore={offset + products.length < count}
            action={
              <Link
                href={`/search?q=${encodeURIComponent(query)}&offset=${offset + PAGE_SIZE}`}
                className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-ink hover:text-white"
              >
                Load more
              </Link>
            }
          />
        </>
      )}
    </main>
  );
}
