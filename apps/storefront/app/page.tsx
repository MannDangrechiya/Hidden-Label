import { moneyFromRupees } from "@thl/shared";
import { ErrorState, ProductCard } from "@thl/ui";
import Link from "next/link";
import { backendUrl, fetchProducts, MedusaError, type StoreProduct } from "@/lib/medusa";

export const dynamic = "force-dynamic";

function priceOf(product: StoreProduct) {
  const amount = product.variants?.[0]?.calculated_price?.calculated_amount;
  return amount === null || amount === undefined ? null : moneyFromRupees(amount);
}

export default async function HomePage() {
  let products: StoreProduct[] = [];
  let error: string | null = null;

  try {
    const data = await fetchProducts({ limit: 8 });
    products = data.products;
  } catch (caught) {
    error =
      caught instanceof MedusaError
        ? caught.message
        : `Unexpected error: ${caught instanceof Error ? caught.message : String(caught)}`;
  }

  return (
    <main>
      {/* Editorial hero — the display step is the page's only 64px moment. */}
      <section className="border-b border-line">
        <div className="mx-auto flex w-full max-w-page flex-col gap-md px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
          <p className="font-mono text-label-caps uppercase text-muted">
            Autumn / Winter — curated selection
          </p>
          <h1 className="type-display-hero max-w-[16ch] uppercase">
            Archive pieces, kept in plain sight.
          </h1>
          <p className="max-w-[52ch] font-sans text-body-lg text-on-surface-variant">
            A tight edit of footwear from the houses worth queuing for. Every pair is sourced,
            checked and priced in INR.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/collections/all"
              className="inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
            >
              Shop all
            </Link>
            <Link
              href="/design"
              className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-ink hover:text-white"
            >
              Design system
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-page px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
        <div className="mb-lg flex items-end justify-between gap-md border-b border-line pb-2">
          <h2 className="font-display text-headline-md uppercase">Latest arrivals</h2>
          <Link
            href="/collections/all"
            className="font-mono text-label-caps uppercase text-muted no-underline hover:text-ink"
          >
            View all
          </Link>
        </div>

        {error ? (
          <ErrorState
            title="Catalogue unavailable"
            message={`${error} (backend: ${backendUrl()})`}
          />
        ) : products.length === 0 ? (
          <p className="border border-line px-6 py-10 font-sans text-body-sm text-on-surface-variant">
            No products are published yet. Run <code>pnpm db:seed</code> to load the development
            catalogue.
          </p>
        ) : (
          <ul className="grid list-none grid-cols-2 gap-gutter p-0 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard
                  brand={
                    typeof product.metadata?.brand === "string" ? product.metadata.brand : null
                  }
                  title={product.title}
                  price={priceOf(product)}
                  imageUrl={product.thumbnail}
                  href={`/products/${product.handle}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
