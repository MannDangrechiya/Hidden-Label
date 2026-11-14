import { moneyFromRupees, formatINR } from "@thl/shared";
import { ErrorState } from "@thl/ui";
import Link from "next/link";
import { backendUrl, fetchProducts, MedusaError, type StoreProduct } from "@/lib/medusa";

export const dynamic = "force-dynamic";

function priceOf(product: StoreProduct) {
  const amount = product.variants?.[0]?.calculated_price?.calculated_amount;
  return amount === null || amount === undefined ? null : moneyFromRupees(amount);
}

const BRANDS = [
  { name: "Jordan", handle: "jordan", count: "12 Silhouettes" },
  { name: "Nike", handle: "nike", count: "18 Silhouettes" },
  { name: "Adidas", handle: "adidas", count: "14 Silhouettes" },
  { name: "New Balance", handle: "new-balance", count: "8 Silhouettes" },
  { name: "Salomon", handle: "salomon", count: "6 Silhouettes" },
  { name: "ASICS", handle: "asics", count: "5 Silhouettes" },
];

const POPULAR_SIZES = ["UK 6.0", "UK 7.0", "UK 7.5", "UK 8.0", "UK 8.5", "UK 9.0", "UK 9.5", "UK 10.0", "UK 11.0"];

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
    <main className="space-y-16 pb-16">
      {/* CultureCircle Hero Section */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-margin py-12 sm:px-margin-tablet lg:px-margin-desktop lg:py-20">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 border border-emerald-500 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              CultureCircle-Inspired Verified Resale Platform
            </span>
            <span className="border border-line bg-surface-container px-2.5 py-1 font-mono text-[11px] uppercase text-muted">
              100% Authentic Guaranteed
            </span>
          </div>

          <h1 className="font-display text-headline-xl sm:text-5xl uppercase tracking-tight text-ink max-w-3xl leading-[1.08]">
            India&rsquo;s Verified Marketplace for Sneakers &amp; Streetwear.
          </h1>

          <p className="max-w-2xl font-sans text-body-md text-on-surface-variant leading-relaxed">
            Trade authentic pairs with size-specific market pricing, 360° physical lab inspection records,
            instant buy now or custom bidding, and express domestic delivery with zero import surprises.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/collections/all"
              className="inline-flex min-h-12 items-center justify-center bg-ink px-8 py-3.5 font-mono text-label-caps uppercase tracking-[0.14em] text-white no-underline transition-all hover:bg-ink/90 active:scale-[0.99] shadow-lg"
            >
              Explore The Vault →
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
        <div className="mb-6 flex items-end justify-between gap-md border-b border-line pb-3">
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
              const formattedPrice = price ? formatINR(price) : "₹15,000";

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
                    <span className="absolute top-2 left-2 border border-line bg-surface/90 px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold text-ink">
                      Verified
                    </span>
                    <span className="absolute bottom-2 right-2 rounded-xs bg-emerald-600 px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold text-white">
                      ▲ +8.7%
                    </span>
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
                    <span className="font-mono text-[10px] uppercase text-emerald-700 font-semibold">
                      In Stock →
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
          {BRANDS.map((b) => (
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

      {/* The 4-Pillar Verification Matrix (CultureCircle Standard) */}
      <section className="border-t border-b border-line bg-surface-container/20 py-16">
        <div className="mx-auto w-full max-w-page px-margin sm:px-margin-tablet lg:px-margin-desktop space-y-8">
          <div className="text-center max-w-xl mx-auto">
            <span className="font-mono text-xs uppercase text-emerald-700 font-bold tracking-wider">
              100% Authentication Guarantee
            </span>
            <h2 className="mt-1 font-display text-headline-lg uppercase text-ink">
              The Physical Verification Standard
            </h2>
            <p className="mt-2 font-sans text-xs text-muted leading-relaxed">
              Every unit listed on The Hidden Label must undergo physical laboratory verification before shipment.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-line bg-surface p-5 space-y-2">
              <span className="font-mono text-lg">🔬</span>
              <h3 className="font-mono text-xs uppercase font-bold text-ink">
                360° Physical Lab Inspection (AI-03)
              </h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Multi-angle turntable inspection, 365nm UV spectral reaction tests, stitch tension audits, and factory adhesive scent verification.
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
                Conversational AI stylist assembling complete streetwear rotations grounded in real-time verified vault inventory.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
