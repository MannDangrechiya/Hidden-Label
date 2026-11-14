import { moneyFromRupees } from "@thl/shared";
import { Breadcrumb, EmptyState, ErrorState, LoadMore, ProductCard } from "@thl/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchBrand, fetchProductsByIds, MedusaError, type StoreProduct } from "@/lib/medusa";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ offset?: string }>;
}

const PAGE_SIZE = 24;

export async function generateMetadata({ params }: PageProps) {
  const { handle } = await params;
  try {
    const data = await fetchBrand(handle);
    return { title: data?.brand.name ?? "Brand" };
  } catch {
    return { title: "Brand" };
  }
}

function priceOf(product: StoreProduct) {
  const amount = product.variants?.[0]?.calculated_price?.calculated_amount;
  return amount === null || amount === undefined ? null : moneyFromRupees(amount);
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { handle } = await params;
  const { offset: offsetParam } = await searchParams;
  const offset = Math.max(Number(offsetParam ?? 0) || 0, 0);

  let data: Awaited<ReturnType<typeof fetchBrand>> = null;
  let products: StoreProduct[] = [];
  let error: string | null = null;

  try {
    data = await fetchBrand(handle, { limit: PAGE_SIZE, offset });
    if (data) products = await fetchProductsByIds(data.product_ids);
  } catch (caught) {
    error =
      caught instanceof MedusaError
        ? caught.message
        : `Unexpected error: ${caught instanceof Error ? caught.message : String(caught)}`;
  }

  if (!error && !data) notFound();

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-4 sm:px-margin-tablet lg:px-margin-desktop">
      <nav aria-label="Breadcrumb" className="mb-sp-3">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Brands", href: "/brands" },
            { label: data?.brand.name ?? "Brand" },
          ]}
          renderLink={(item) => (
            <Link href={item.href ?? "#"} className="text-muted no-underline hover:text-ink">
              {item.label}
            </Link>
          )}
        />
      </nav>

      {error ? (
        <ErrorState title="Could not load this brand" message={error} />
      ) : data ? (
        <>
          <header className="relative mb-sp-4 flex flex-col gap-3 border-b border-line pb-sp-4">
            {data.brand.hero_url ? (
              <div className="relative mb-sp-3 aspect-[21/9] w-full overflow-hidden bg-surface-container">
                <img
                  src={data.brand.hero_url}
                  alt={data.brand.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <p className="font-mono text-label-caps uppercase text-muted">
              {data.brand.country ?? "The Hidden Label"}
            </p>
            <h1 className="type-headline-lg uppercase">{data.brand.name}</h1>
            {data.brand.tagline ? (
              <p className="max-w-[60ch] font-sans text-body-md text-on-surface-variant">
                {data.brand.tagline}
              </p>
            ) : null}
            <p className="font-mono text-label-caps uppercase text-muted">
              {data.count} item{data.count === 1 ? "" : "s"}
            </p>
          </header>

          {products.length === 0 ? (
            <EmptyState
              title="Nothing published yet"
              description={`${data.brand.name} has no live products right now. Check back soon, or browse the full catalogue.`}
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
                      brand={data.brand.name}
                      title={product.title}
                      price={priceOf(product)}
                      imageUrl={product.thumbnail}
                      href={`/products/${product.handle}`}
                    />
                  </li>
                ))}
              </ul>

              <LoadMore
                shown={Math.min(offset + products.length, data.count)}
                total={data.count}
                hasMore={offset + products.length < data.count}
                action={
                  <Link
                    href={`/brands/${handle}?offset=${offset + PAGE_SIZE}`}
                    className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-ink hover:text-white"
                  >
                    Load more
                  </Link>
                }
              />
            </>
          )}
        </>
      ) : null}
    </main>
  );
}
