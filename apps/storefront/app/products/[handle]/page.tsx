import { hsnForProduct, moneyFromRupees } from "@thl/shared";
import { Price } from "@thl/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { SizeOption } from "@/components/add-to-bag";
import { ProductBuyPanel } from "@/components/product-buy-panel";
import { isApparelProduct } from "@/lib/catalog";
import { WishlistButton } from "@/components/wishlist-button";
import { PriceIndexCard } from "@/components/price-index-card";
import { InspectionViewer } from "@/components/inspection-viewer";
import { FitStudioWidget } from "@/components/fit-studio-widget";
import { ProductReviews } from "@/components/product-reviews";
import { DeliveryChecker } from "@/components/delivery-checker";
import {
  fetchResaleProductIndex,
  fetchInspectionCertificate,
  type VariantResaleData,
} from "@/lib/resale";
import {
  fetchProduct,
  fetchWishlist,
  fetchProductReviews,
  isVariantAvailable,
  knownStock,
  MedusaError,
  type StoreProduct,
} from "@/lib/medusa";
import { getCurrentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { handle } = await params;
  try {
    const product = await fetchProduct(handle);
    return { title: product?.title ?? "Product" };
  } catch {
    return { title: "Product" };
  }
}

function sizesFor(product: StoreProduct, resaleVariants?: VariantResaleData[]): SizeOption[] {
  // The store API does not guarantee variant order; sizes are shown numerically (UK 7 → UK 10).
  const ordered = [...(product.variants ?? [])].sort((a, b) =>
    String(a.title ?? "").localeCompare(String(b.title ?? ""), undefined, { numeric: true }),
  );

  const asks = (resaleVariants ?? [])
    .map((v) => v.lowest_ask)
    .filter((a): a is number => typeof a === "number" && a > 0);
  const minAsk = asks.length > 0 ? Math.min(...asks) : null;

  return ordered.map((variant) => {
    const rv = resaleVariants?.find((v) => v.variant_id === variant.id);
    const ask = rv?.lowest_ask ?? variant.calculated_price?.calculated_amount ?? null;
    return {
      variantId: variant.id,
      label: variant.title ?? variant.sku ?? "One size",
      available: isVariantAvailable(variant),
      quantity: knownStock(variant),
      lowestAsk: ask,
      highestBid: rv?.highest_bid ?? null,
      isLowestPriceInRun: ask !== null && minAsk !== null && ask === minAsk,
    };
  });
}

export default async function ProductPage({ params }: PageProps) {
  const { handle } = await params;

  let product: StoreProduct | null = null;
  let error: string | null = null;

  try {
    product = await fetchProduct(handle);
  } catch (caught) {
    error =
      caught instanceof MedusaError
        ? caught.message
        : `Unexpected error: ${caught instanceof Error ? caught.message : String(caught)}`;
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
        <div role="alert" className="border border-error px-6 py-10">
          <h1 className="mb-2 font-display text-headline-sm text-error">Product unavailable</h1>
          <p className="font-sans text-body-sm text-on-surface-variant">{error}</p>
        </div>
      </main>
    );
  }

  if (!product) notFound();

  const resaleData = await fetchResaleProductIndex(handle).catch(() => null);
  const sizes = sizesFor(product, resaleData?.variants);
  const bespokeEnabled = isApparelProduct(product);
  const firstAvailable = (product.variants ?? []).find(isVariantAvailable);
  const amount = firstAvailable?.calculated_price?.calculated_amount ?? null;
  const brand = typeof product.metadata?.brand === "string" ? product.metadata.brand : null;
  const soldOut = sizes.length > 0 && sizes.every((size) => !size.available);

  const session = await getCurrentCustomer().catch(() => null);
  const sampleSerial = resaleData?.variants?.find((v) => v.inspection_summary?.unit_serial)
    ?.inspection_summary?.unit_serial;
  const inspection = sampleSerial
    ? await fetchInspectionCertificate(sampleSerial).catch(() => null)
    : null;

  let wishlistVariantIds = new Set<string>();
  if (session) {
    try {
      const items = await fetchWishlist(session.token);
      wishlistVariantIds = new Set(items.map((item) => item.variant_id));
    } catch {
      wishlistVariantIds = new Set();
    }
  }

  const reviewData = await fetchProductReviews(product.id).catch(() => ({
    reviews: [],
    stats: { count: 0, average_rating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
  }));

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-4 sm:px-margin-tablet lg:px-margin-desktop">
      <nav aria-label="Breadcrumb" className="mb-sp-3">
        <ol className="flex list-none gap-2 p-0 font-mono text-label-caps uppercase text-muted">
          <li>
            <Link href="/" className="text-muted no-underline hover:text-ink">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/collections/all" className="text-muted no-underline hover:text-ink">
              Shop
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink">{product.title}</li>
        </ol>
      </nav>

      <div className="grid gap-sp-4 lg:grid-cols-2 lg:gap-sp-5">
        <div className="flex flex-col gap-2">
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-container">
            {product.thumbnail ? (
              <img
                src={product.thumbnail}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-mono text-label-caps uppercase text-muted">
                Image pending
              </div>
            )}
          </div>

          {/* 360° Inspection Viewer & Lab Authentication (AI-03) */}
          {inspection ? (
            <div className="mt-2">
              <InspectionViewer inspection={inspection} compact={false} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-sp-4">
          <div className="flex flex-col gap-2 border-b border-line pb-sp-3">
            {brand ? (
              <span className="font-mono text-label-caps uppercase text-muted">{brand}</span>
            ) : null}
            <h1 className="font-display text-headline-lg uppercase">{product.title}</h1>
            <div className="flex items-baseline gap-3">
              <Price value={amount === null ? null : moneyFromRupees(amount)} size="lg" />
              {soldOut ? (
                <span className="font-mono text-label-caps uppercase text-muted">
                  Sold out — all sizes
                </span>
              ) : null}
              <span className="font-mono text-label-caps uppercase text-muted">
                · Quick View enabled
              </span>
            </div>
          </div>

          {/* Fit Studio Sizing Assistant (AI-04) */}
          <FitStudioWidget
            productTitle={product.title}
            productHandle={product.handle}
          />

          <ProductBuyPanel
            sizes={sizes}
            productHandle={product.handle}
            productTitle={product.title}
            bespokeEnabled={bespokeEnabled}
            signedIn={Boolean(session)}
          />

          {/* Secondary Market Orderbook & The Price Index (AI-02) */}
          {resaleData && resaleData.variants.length > 0 ? (
            <PriceIndexCard
              variants={resaleData.variants}
              selectedVariantId={firstAvailable?.id}
              customerToken={session?.token ?? null}
            />
          ) : null}

          {firstAvailable ? (
            session ? (
              <WishlistButton
                variantId={firstAvailable.id}
                initialSaved={wishlistVariantIds.has(firstAvailable.id)}
              />
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-12 w-fit items-center justify-center border border-line px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-muted no-underline transition-colors hover:border-ink hover:text-ink"
              >
                Sign in to save
              </Link>
            )
          ) : null}

          {product.description ? (
            <div className="border-t border-line pt-sp-3">
              <h2 className="mb-2 font-mono text-label-caps uppercase text-muted">Details</h2>
              <p className="font-sans text-body-sm text-on-surface-variant">{product.description}</p>
            </div>
          ) : null}

          {/* GAP-REG-04: Legal Metrology (Packaged Commodities) Rules declarations. */}
          <div className="border-t border-line pt-sp-3">
            <h2 className="mb-2 font-mono text-label-caps uppercase text-muted">
              Product declarations
            </h2>
            <dl className="m-0 grid grid-cols-[150px_1fr] gap-y-1 font-sans text-body-sm text-on-surface-variant">
              <dt className="font-mono text-[11px] uppercase text-muted">Country of origin</dt>
              <dd className="m-0">
                {typeof product.metadata?.country_of_origin === "string" &&
                product.metadata.country_of_origin.trim()
                  ? product.metadata.country_of_origin
                  : "Declaration pending verification"}
              </dd>
              <dt className="font-mono text-[11px] uppercase text-muted">Net quantity</dt>
              <dd className="m-0">1 unit</dd>
              <dt className="font-mono text-[11px] uppercase text-muted">MRP</dt>
              <dd className="m-0">
                {amount === null ? "—" : `₹${amount.toLocaleString("en-IN")}`} inclusive of all
                taxes
              </dd>
              <dt className="font-mono text-[11px] uppercase text-muted">HSN</dt>
              <dd className="m-0">
                {typeof product.metadata?.hsn === "string"
                  ? product.metadata.hsn
                  : hsnForProduct(
                      product.title,
                      typeof product.metadata?.gender === "string" ? product.metadata.gender : null,
                    )}
              </dd>
              <dt className="font-mono text-[11px] uppercase text-muted">Marketed by</dt>
              <dd className="m-0">
                {process.env.BUSINESS_LEGAL_NAME ?? "The Hidden Label Luxury Retail Pvt Ltd"},
                Ahmedabad, Gujarat
              </dd>
              <dt className="font-mono text-[11px] uppercase text-muted">Consumer care</dt>
              <dd className="m-0">
                {process.env.SUPPORT_EMAIL ?? "concierge@thehiddenlabel.com"} ·{" "}
                {process.env.SUPPORT_PHONE ?? "+91 79 4000 0000"}
              </dd>
            </dl>
          </div>

          <div className="border-t border-line pt-sp-3">
            <h2 className="mb-2 font-mono text-label-caps uppercase text-muted">Shipping &amp; returns</h2>
            <p className="font-sans text-body-sm text-on-surface-variant mb-3">
              Dispatched in 2–4 working days. Returns accepted within the 7-day policy window if the item
              is unworn with tags. All prices in INR, inclusive of duties and GST.
            </p>
            <DeliveryChecker />
          </div>
        </div>
      </div>

      {/* Verified Client Reviews & Ratings (Phase 5) */}
      <ProductReviews
        productId={product.id}
        initialReviews={reviewData.reviews}
        initialStats={reviewData.stats}
      />

      {reviewData.stats.count > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: product.title,
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: reviewData.stats.average_rating,
                reviewCount: reviewData.stats.count,
              },
            }),
          }}
        />
      )}
    </main>
  );
}
