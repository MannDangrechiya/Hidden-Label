import { moneyFromRupees } from "@thl/shared";
import { EmptyState, ErrorState, ProductCard } from "@thl/ui";
import { fetchProducts, MedusaError, type StoreProduct } from "@/lib/medusa";

export const dynamic = "force-dynamic";

export const metadata = { title: "Shop all" };

function priceOf(product: StoreProduct) {
  const amount = product.variants?.[0]?.calculated_price?.calculated_amount;
  return amount === null || amount === undefined ? null : moneyFromRupees(amount);
}

export default async function CatalogPage() {
  let products: StoreProduct[] = [];
  let count = 0;
  let error: string | null = null;

  try {
    const data = await fetchProducts({ limit: 48 });
    products = data.products;
    count = data.count;
  } catch (caught) {
    error =
      caught instanceof MedusaError
        ? caught.message
        : `Unexpected error: ${caught instanceof Error ? caught.message : String(caught)}`;
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-lg flex flex-col gap-2 border-b border-line pb-md">
        <h1 className="type-headline-lg uppercase">Shop all</h1>
        <p className="font-mono text-label-caps uppercase text-muted">
          {error ? "Catalogue unavailable" : `${count} product${count === 1 ? "" : "s"}`}
        </p>
      </header>

      {error ? (
        <ErrorState title="Could not load the catalogue" message={error} />
      ) : products.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="No products are published. Add products in the admin or run the seed script."
        />
      ) : (
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
      )}
    </main>
  );
}
