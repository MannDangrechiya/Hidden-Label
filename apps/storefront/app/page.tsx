import { moneyFromRupees, formatINR } from "@thl/shared";
import { ErrorState } from "@thl/ui";
import Link from "next/link";
import {
  backendUrl,
  fetchBrands,
  fetchProducts,
  fetchStock,
  MedusaError,
  type StoreProduct,
} from "@/lib/medusa";

export const dynamic = "force-dynamic";

function priceOf(product: StoreProduct) {
  const amount = product.variants?.[0]?.calculated_price?.calculated_amount;
  return amount === null || amount === undefined ? null : moneyFromRupees(amount);
}

const POPULAR_SIZES = ["UK 6.0", "UK 7.0", "UK 7.5", "UK 8.0", "UK 8.5", "UK 9.0", "UK 9.5", "UK 10.0", "UK 11.0"];

export default async function HomePage() {
  let products: StoreProduct[] = [];
  let error: string | null = null;
  let stockMap: Record<string, { available: number }> = {};
  let brandList: Array<{ name: string; handle: string; count: string }> = [];

  try {
    const data = await fetchProducts({ limit: 8 });
    products = data.products;

    // Fetch real-time stock availability for variants to prevent false in-stock claims (BUG-07)
    const variantIds = products.flatMap((p) => (p.variants ?? []).map((v) => v.id));
    if (variantIds.length > 0) {
      stockMap = await fetchStock(variantIds).catch(() => ({}));
    }
  } catch (caught) {
    error =
      caught instanceof MedusaError
        ? caught.message
        : `Unexpected error: ${caught instanceof Error ? caught.message : String(caught)}`;
  }

  try {
    // Dynamic brand discovery querying published product counts (BUG-06)
    const { brands } = await fetchBrands();
    if (brands.length > 0) {
      brandList = brands.slice(0, 12).map((b) => ({
        name: b.name,
        handle: b.handle,
        count: `${b.product_count} ${b.product_count === 1 ? "Silhouette" : "Silhouettes"}`,
      }));
    }
  } catch {
    // Fall back to documented catalogue brands if backend is warming up
  }

  if (brandList.length === 0) {
    brandList = [
      { name: "Jordan", handle: "jordan", count: "Vault Series" },
      { name: "Nike", handle: "nike", count: "Vault Series" },
      { name: "Adidas", handle: "adidas", count: "Vault Series" },
      { name: "New Balance", handle: "new-balance", count: "Vault Series" },
      { name: "Salomon", handle: "salomon", count: "Vault Series" },
      { name: "ASICS", handle: "asics", count: "Vault Series" },
    ];
  }

  return (
    <main className="space-y-16 pb-16">
      {/* CultureCircle Hero Section */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-margin py-12 sm:px-margin-tablet lg:px-margin-desktop lg:py-20">
          <div className="flex flex-wrap items-center gap-2">
            {/* D2: no blanket "100% authentic guaranteed" claim without a real enforced
                inspection-before-fulfillment workflow backing it. */}
            <span className="inline-flex items-center gap-1.5 border border-emerald-500 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Resale Marketplace
            </span>
          </div>

          <h1 className="font-display text-headline-xl sm:text-5xl uppercase tracking-tight text-ink max-w-3xl leading-[1.08]">
            India&rsquo;s Marketplace for Sneakers &amp; Streetwear.
          </h1>

          <p className="max-w-2xl font-sans text-body-md text-on-surface-variant leading-relaxed">
            Trade pairs with size-specific market pricing, physical lab inspection records on
            inspected units, instant buy now or custom bidding, and express domestic delivery
            with zero import surprises.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/collections/all"
              className="inline-flex min-h-12 items-center justify-center bg-ink px-8 py-3.5 font-mono text-label-caps uppercase tracking-[0.14em] text-white no-underline transition-all hover:bg-ink/90 active:scale-[0.99] shadow-lg"
            >
              Explore The Vault →
            </Link>
            <Link
              href="/sell"
              className="inline-flex min-h-12 items-center justify-center border border-emerald-600 bg-emerald-50 px-6 py-3.5 font-mono text-label-caps uppercase tracking-[0.12em] text-emerald-800 no-underline transition-colors hover:bg-emerald-100"
            >
              Sell / Consign
            </Link>
            <Link
              href="/fit-studio"
              className="inline-flex min-h-12 items-center justify-center border border-ink bg-transparent px-6 py-3.5 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-surface-container"
            >
              Fit Studio (AI-04)
            </Link>
          </div>

          {/* Quick Shop by Size Filter Bar */}
          <div className="pt-6 border-t border-line/60">
            <span className="block font-mono text-[11px] uppercase text-muted mb-2">
              Instant Shop by Size (Live Inventory in INR):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {POPULAR_SIZES.map((size) => (
                <Link
                  key={size}
                  href={`/collections/all?size=${encodeURIComponent(size)}`}
                  className="px-3 py-1.5 border border-line bg-surface font-mono text-xs text-ink hover:border-ink hover:bg-ink hover:text-white transition-colors no-underline"
                >
                  {size}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trending Drops & Market Movers Grid */}
      <section className="mx-auto w-full max-w-page px-margin sm:px-margin-tablet lg:px-margin-desktop">
        <div className="mb-6 flex items-end justify-between gap-sp-3 border-b border-line pb-3">
          <div>
            <span className="font-mono text-[11px] uppercase text-muted">Secondary Orderbook</span>
            <h2 className="font-display text-headline-md uppercase text-ink">Trending Vault Drops</h2>
          </div>
          <Link
            href="/collections/all"
            className="font-mono text-xs uppercase underline text-muted hover:text-ink"
          >
            View All ({products.length}) →
          </Link>
        </div>

        {error ? (
          <ErrorState
            title="Catalogue unavailable"
            message={`${error} (backend: ${backendUrl()})`}
          />
        ) : products.length === 0 ? (
          <p className="border border-line px-6 py-10 font-sans text-body-sm text-on-surface-variant">
            No products are published yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const price = priceOf(product);
              const brand = typeof product.metadata?.brand === "string" ? product.metadata.brand : "Sneaker Vault";
              // D2: never fabricate a price when the real calculated price is missing.
              const formattedPrice = price ? formatINR(price) : "Price unavailable";

              const isAvailable = (product.variants ?? []).some((v) => {
                const stock = stockMap[v.id]?.available;
                if (typeof stock === "number") return stock > 0;
                return v.inventory_quantity === undefined || v.inventory_quantity === null || v.inventory_quantity > 0;
              });

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.handle}`}
                  className="group flex flex-col border border-line bg-surface p-3 sm:p-4 hover:border-ink transition-all no-underline"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-surface-container mb-3">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted">
                        No image
                      </div>
                    )}
                    {/* D2: no blanket "Verified" claim or fabricated trend % — real
                        per-unit authentication status lives on the product page. */}
                  </div>

                  <span className="font-mono text-[10px] uppercase text-muted truncate">
                    {brand}
                  </span>
                  <h3 className="font-display text-xs sm:text-sm uppercase text-ink font-semibold truncate group-hover:underline">
                    {product.title}
                  </h3>

                  <div className="mt-2 pt-2 border-t border-line/60 flex items-baseline justify-between">
                    <div>
                      <span className="block font-mono text-[9px] uppercase text-muted">Lowest Ask</span>
                      <span className="font-sans text-sm font-bold text-ink">{formattedPrice}</span>
                    </div>
                    <span
                      className={`font-mono text-[10px] uppercase font-semibold ${
                        isAvailable ? "text-emerald-700" : "text-muted"
                      }`}
                    >
                      {isAvailable ? "In Stock →" : "Sold Out"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Brand Discovery Pavilion */}
      <section className="mx-auto w-full max-w-page px-margin sm:px-margin-tablet lg:px-margin-desktop">
        <div className="mb-6 border-b border-line pb-3">
          <span className="font-mono text-[11px] uppercase text-muted">Houses Worth Queuing For</span>
          <h2 className="font-display text-headline-md uppercase text-ink">Browse by Brand</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {brandList.map((b) => (
            <Link
              key={b.handle}
              href={`/brands/${b.handle}`}
              className="border border-line bg-surface p-4 text-center hover:border-ink hover:bg-surface-container/30 transition-all no-underline group"
            >
              <h3 className="font-display text-base uppercase text-ink group-hover:underline">
                {b.name}
              </h3>
              <span className="font-mono text-[10px] uppercase text-muted mt-1 block">
                {b.count}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* D2: no absolute "100% guarantee" / "every unit must" claim without an enforced
          inspect-before-fulfilment workflow backing it (not built yet — see
          docs/MASTER_PLAN.md §2). This section describes the capability honestly instead. */}
      <section className="border-t border-b border-line bg-surface-container/20 py-16">
        <div className="mx-auto w-full max-w-page px-margin sm:px-margin-tablet lg:px-margin-desktop space-y-8">
          <div className="text-center max-w-xl mx-auto">
            <span className="font-mono text-xs uppercase text-emerald-700 font-bold tracking-wider">
              Physical Inspection Programme
            </span>
            <h2 className="mt-1 font-display text-headline-lg uppercase text-ink">
              The Physical Verification Standard
            </h2>
            <p className="mt-2 font-sans text-xs text-muted leading-relaxed">
              Units that complete our lab inspection carry a real, viewable authentication report
              on their product page — look for it before you buy.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-line bg-surface p-5 space-y-2">
              <span className="font-mono text-lg">🔬</span>
              <h3 className="font-mono text-xs uppercase font-bold text-ink">
                360° Physical Lab Inspection (AI-03)
              </h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Multi-angle turntable photography and a manual review of box labelling, size
                tags, stitching, sole tooling and material feel against the brand's own
                reference — recorded as a real inspection record per unit.
              </p>
            </div>

            <div className="border border-line bg-surface p-5 space-y-2">
              <span className="font-mono text-lg">📊</span>
              <h3 className="font-mono text-xs uppercase font-bold text-ink">
                The Price Index (AI-02)
              </h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Size-specific secondary trade history with 30-day volatility curves, lowest active asks, and live buyer bids with zero hidden fees.
              </p>
            </div>

            <div className="border border-line bg-surface p-5 space-y-2">
              <span className="font-mono text-lg">📐</span>
              <h3 className="font-mono text-xs uppercase font-bold text-ink">
                Fit Studio Sizing Engine (AI-04)
              </h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Metric foot length in millimeters mapped against silhouette toe-box geometry. Never order the wrong size again.
              </p>
            </div>

            <div className="border border-line bg-surface p-5 space-y-2">
              <span className="font-mono text-lg">✨</span>
              <h3 className="font-mono text-xs uppercase font-bold text-ink">
                Aura-7 Style Concierge (AI-05)
              </h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Conversational stylist assembling streetwear rotations grounded in real-time catalogue inventory.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
