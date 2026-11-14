import { moneyFromRupees } from "@thl/shared";
import { Price } from "@thl/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToBag, type SizeOption } from "@/components/add-to-bag";
import { WishlistButton } from "@/components/wishlist-button";
import { PriceIndexCard } from "@/components/price-index-card";
import { InspectionViewer } from "@/components/inspection-viewer";
import { FitStudioWidget } from "@/components/fit-studio-widget";
import {
  fetchResaleProductIndex,
  fetchInspectionCertificate,
  type VariantResaleData,
} from "@/lib/resale";
import {
  fetchProduct,
  fetchWishlist,
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
      <main className="mx-auto w-full max-w-page px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
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

  return (
    <main className="mx-auto w-full max-w-page px-margin py-lg sm:px-margin-tablet lg:px-margin-desktop">
      <nav aria-label="Breadcrumb" className="mb-md">
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

      <div className="grid gap-lg lg:grid-cols-2 lg:gap-xl">
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

        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-2 border-b border-line pb-md">
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
            </div>
          </div>

          {/* Fit Studio Sizing Assistant (AI-04) */}
          <FitStudioWidget
            productTitle={product.title}
            productHandle={product.handle}
          />

          <AddToBag sizes={sizes} />

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
            <div className="border-t border-line pt-md">
              <h2 className="mb-2 font-mono text-label-caps uppercase text-muted">Details</h2>
              <p className="font-sans text-body-sm text-on-surface-variant">{product.description}</p>
            </div>
          ) : null}

          <div className="border-t border-line pt-md">
            <h2 className="mb-2 font-mono text-label-caps uppercase text-muted">Shipping &amp; returns</h2>
            <p className="font-sans text-body-sm text-on-surface-variant">
              Dispatched in 2–4 working days. Returns accepted within the policy window if the item
              is unworn with tags. All prices in INR, inclusive of duties and GST.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
