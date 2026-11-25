import { moneyFromRupees, type Money } from "@thl/shared";
import { ErrorState } from "@thl/ui";
import Link from "next/link";
import {
  aiLayerEnabled,
  fitStudioEnabled,
  resaleEnabled,
} from "@/lib/feature-flags";
import {
  backendUrl,
  fetchBrands,
  fetchProducts,
  fetchStock,
  MedusaError,
  isVariantAvailable,
  type StoreProduct,
} from "@/lib/medusa";
import { ProductCardLink } from "@/components/product-card-link";
import { RETURN_WINDOW_DAYS } from "@/lib/return-window";

export const dynamic = "force-dynamic";

type CardRow = { product: StoreProduct; price: Money | null; brand: string | null; available: boolean };

function toRow(product: StoreProduct, stockMap: Record<string, { available: number }>): CardRow {
  const amount = product.variants?.[0]?.calculated_price?.calculated_amount;
  const brand =
    typeof product.metadata?.brand === "string" && product.metadata.brand.trim()
      ? product.metadata.brand
      : null;
  const available = (product.variants ?? []).some((variant) => {
    const stock = stockMap[variant.id]?.available;
    if (typeof stock === "number") return stock > 0;
    return isVariantAvailable(variant);
  });
  return {
    product,
    price: amount === null || amount === undefined ? null : moneyFromRupees(amount),
    brand,
    available,
  };
}

const POPULAR_SIZES = ["UK 6.0", "UK 7.0", "UK 7.5", "UK 8.0", "UK 8.5", "UK 9.0", "UK 9.5", "UK 10.0", "UK 11.0"];

const CATEGORY_LINKS = [
  { label: "Footwear", href: "/collections/all?category=footwear" },
  { label: "Menswear", href: "/collections/all?category=menswear" },
  { label: "Womenswear", href: "/collections/all?category=womenswear" },
  { label: "Accessories", href: "/collections/all?category=accessories" },
  { label: "Custom Bespoke", href: "/collections/all?category=bespoke" },
];

export default async function HomePage() {
  // D7: the resale marketplace and the AI layer are separately gated. Copy that promises live
  // bids, price history or the concierge is only rendered when the matching flag is actually on.
  const resaleOn = resaleEnabled();
  const aiOn = aiLayerEnabled();
  const fitStudioOn = fitStudioEnabled();

  let error: string | null = null;
  let heroRow: CardRow | null = null;
  let rows: CardRow[] = [];
  let latestRows: CardRow[] = [];
  let brandList: Array<{ name: string; handle: string; count: string }> = [];
  let categoryCounts: Array<{ label: string; href: string; count: number }> = [];

  try {
    const [{ products: featured }, { products: latest }] = await Promise.all([
      fetchProducts({ limit: 8 }),
      fetchProducts({ limit: 4, order: "-created_at" }),
    ]);

    // Fetch real-time stock availability for variants to prevent false in-stock claims (BUG-07)
    const variantIds = [...featured, ...latest].flatMap((p) => (p.variants ?? []).map((v) => v.id));
    const stockMap = variantIds.length > 0 ? await fetchStock(variantIds).catch(() => ({})) : {};

    rows = featured.map((product) => toRow(product, stockMap));
    latestRows = latest
      .filter((product) => !rows.some((row) => row.product.id === product.id))
      .slice(0, 4)
      .map((product) => toRow(product, stockMap));

    // Hero visual: the first available featured product's own photography — no fabricated imagery.
    heroRow = rows.find((row) => row.available && row.product.thumbnail) ?? rows[0] ?? null;

    // Real category counts from the fetched catalogue page.
    categoryCounts = CATEGORY_LINKS.map((entry) => {
      const key = entry.href.split("category=")[1];
      const count = rows.filter((row) => {
        const metadata = row.product.metadata ?? {};
        const tags = Array.isArray(metadata.tags) ? metadata.tags.map(String) : [];
        const gender = typeof metadata.gender === "string" ? metadata.gender : "";
        const title = row.product.title.toLowerCase();
        switch (key) {
          case "footwear":
            return /sneaker|shoe|boot|sandal|loafer/i.test(title) || tags.includes("footwear");
          case "menswear":
            return gender === "men" || tags.includes("menswear");
          case "womenswear":
            return gender === "women" || tags.includes("womenswear");
          case "accessories":
            return tags.includes("accessories");
          case "bespoke":
            return tags.includes("bespoke") || /bespoke|made-to-measure|tailor/i.test(title);
          default:
            return false;
        }
      }).length;
      return { label: entry.label, href: entry.href, count };
    });
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
    // No hardcoded fallback: fabricating brand names when the backend is unreachable would
    // present invented data as real. The section simply renders nothing (see below).
  }

  return (
    <main className="pb-16">
      {/* ---------------------------------------------------------------- Hero (editorial split) */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid w-full max-w-page gap-sp-5 px-margin py-sp-5 sm:px-margin-tablet lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-margin-desktop lg:py-sp-6">
          <div className="flex flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-2 border border-line px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {resaleOn ? "Resale Marketplace" : "Luxury Retail & Bespoke Atelier"}
            </span>

            <h1 className="font-display type-display-hero uppercase leading-[1.02] text-ink max-w-[13ch] sm:max-w-none">
              {resaleOn
                ? "India's Marketplace for Sneakers & Streetwear."
                : "Curated Luxury Footwear & Apparel."}
            </h1>

            <p className="max-w-[52ch] font-sans text-body-lg text-on-surface-variant">
              {resaleOn
                ? "Trade pairs with size-specific market pricing, physical lab inspection records on inspected units, instant buy now or custom bidding, and express domestic delivery with zero import surprises."
                : "Size-specific inventory, complimentary nationwide dispatch or boutique collection at Sindhu Bhavan Road, and made-to-measure tailoring from the in-house atelier."}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/collections/all"
                className="inline-flex min-h-12 items-center justify-center bg-ink px-8 py-3.5 font-mono text-label-caps uppercase tracking-[0.14em] text-white no-underline transition-colors hover:bg-ink/85"
              >
                Explore The Vault →
              </Link>
              <Link
                href="/brands"
                className="inline-flex min-h-12 items-center justify-center border border-ink bg-transparent px-6 py-3.5 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-surface-container"
              >
                Browse Brands
              </Link>
              {resaleOn ? (
                <Link
                  href="/sell"
                  className="inline-flex min-h-12 items-center justify-center border border-line bg-transparent px-6 py-3.5 font-mono text-label-caps uppercase tracking-[0.12em] text-on-surface-variant no-underline transition-colors hover:border-ink hover:text-ink"
                >
                  Sell / Consign
                </Link>
              ) : null}
            </div>

            {/* Quick Shop by Size — live inventory in INR */}
            <div className="border-t border-line pt-4">
              <span className="mb-2 block font-mono text-[11px] uppercase text-muted">
                Shop by size — live inventory in INR:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {POPULAR_SIZES.map((size) => (
                  <Link
                    key={size}
                    href={`/collections/all?size=${encodeURIComponent(size)}`}
                    className="inline-flex min-h-11 items-center px-3 py-1.5 border border-line bg-canvas font-mono text-xs text-ink no-underline transition-colors hover:border-ink hover:bg-ink hover:text-white"
                  >
                    {size}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Hero image: real product photography from the catalogue. Links to its product page. */}
          {heroRow ? (
            <Link
              href={`/products/${heroRow.product.handle}`}
              className="group relative block aspect-[4/5] w-full overflow-hidden bg-surface-container no-underline lg:aspect-[3/4]"
              aria-label={`Featured: ${heroRow.product.title}`}
            >
              {heroRow.product.thumbnail ? (
                <img
                  src={heroRow.product.thumbnail}
                  alt={heroRow.product.title}
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-ink/70 to-transparent p-4">
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-white/80">
                    {heroRow.brand ?? "The Hidden Label"}
                  </span>
                  <span className="block truncate font-display text-headline-sm uppercase text-white">
                    {heroRow.product.title}
                  </span>
                </div>
                <span className="shrink-0 border border-white/40 px-3 py-2 font-mono text-label-caps uppercase text-white">
                  View piece →
                </span>
              </div>
            </Link>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------------ Service & trust strip */}
      <section aria-label="Service information" className="border-b border-line bg-canvas">
        <div className="mx-auto grid w-full max-w-page grid-cols-2 gap-px px-margin py-sp-3 font-mono text-label-caps uppercase text-on-surface-variant sm:px-margin-tablet lg:grid-cols-4 lg:px-margin-desktop">
          <p className="m-0">Dispatch in 2–4 working days</p>
          <p className="m-0">{RETURN_WINDOW_DAYS}-day returns on unworn pieces</p>
          <p className="m-0">INR pricing, inclusive of GST</p>
          <p className="m-0">Boutique collection · Sindhu Bhavan Road</p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- New arrivals */}
      {error ? (
        <section className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
          <ErrorState title="Catalogue unavailable" message={`${error} (backend: ${backendUrl()})`} />
        </section>
      ) : (
        <>
          {latestRows.length > 0 ? (
            <section aria-labelledby="new-in-heading" className="mx-auto w-full max-w-page px-margin pt-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
              <div className="mb-sp-3 flex items-end justify-between gap-sp-3 border-b border-line pb-3">
                <div>
                  <span className="font-mono text-[11px] uppercase text-muted">Just landed</span>
                  <h2 id="new-in-heading" className="font-display text-headline-md uppercase text-ink">
                    New Arrivals
                  </h2>
                </div>
                <Link
                  href="/collections/all"
                  className="inline-flex min-h-11 items-center font-mono text-xs uppercase text-muted underline underline-offset-4 hover:text-ink"
                >
                  View all →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {latestRows.map((row) => (
                  <ProductCardLink
                    key={row.product.id}
                    product={row.product}
                    price={row.price}
                    brand={row.brand}
                    available={row.available}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* -------------------------------------------------------- The Vault (featured) */}
          <section aria-labelledby="vault-heading" className="mx-auto w-full max-w-page px-margin pt-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
            <div className="mb-sp-3 flex items-end justify-between gap-sp-3 border-b border-line pb-3">
              <div>
                <span className="font-mono text-[11px] uppercase text-muted">
                  {resaleOn ? "Secondary Orderbook" : "The Vault"}
                </span>
                <h2 id="vault-heading" className="font-display text-headline-md uppercase text-ink">
                  Trending Vault Drops
                </h2>
              </div>
              <Link
                href="/collections/all"
                className="inline-flex min-h-11 items-center font-mono text-xs uppercase text-muted underline underline-offset-4 hover:text-ink"
              >
                View all ({rows.length}) →
              </Link>
            </div>

            {rows.length === 0 ? (
              <p className="border border-line px-6 py-10 font-sans text-body-sm text-on-surface-variant">
                No products are published yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {rows.map((row) => (
                  <ProductCardLink
                    key={row.product.id}
                    product={row.product}
                    price={row.price}
                    brand={row.brand}
                    available={row.available}
                  />
                ))}
              </div>
            )}
          </section>

          {/* -------------------------------------------------------- Featured categories */}
          <section aria-labelledby="categories-heading" className="mx-auto w-full max-w-page px-margin pt-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
            <div className="mb-sp-3 border-b border-line pb-3">
              <span className="font-mono text-[11px] uppercase text-muted">Shop the edit</span>
              <h2 id="categories-heading" className="font-display text-headline-md uppercase text-ink">
                Featured Categories
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {CATEGORY_LINKS.map((entry) => {
                const count = categoryCounts.find((c) => c.href === entry.href)?.count ?? 0;
                return (
                  <Link
                    key={entry.label}
                    href={entry.href}
                    className="group flex min-h-[88px] flex-col justify-between border border-line bg-surface p-4 no-underline transition-colors hover:border-ink"
                  >
                    <span className="font-display text-headline-sm uppercase text-ink group-hover:underline">
                      {entry.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-muted">
                      {count > 0 ? `${count} in this drop` : "Browse the edit"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* -------------------------------------------------------- Brand discovery (only real, backend-backed brands) */}
          {brandList.length > 0 ? (
          <section aria-labelledby="brands-heading" className="mx-auto w-full max-w-page px-margin pt-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
            <div className="mb-sp-3 border-b border-line pb-3">
              <span className="font-mono text-[11px] uppercase text-muted">Houses worth queuing for</span>
              <h2 id="brands-heading" className="font-display text-headline-md uppercase text-ink">
                Browse by Brand
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {brandList.map((b) => (
                <Link
                  key={b.handle}
                  href={`/brands/${b.handle}`}
                  className="group border border-line bg-surface p-4 text-center no-underline transition-colors hover:border-ink"
                >
                  <h3 className="font-display text-base uppercase text-ink group-hover:underline">{b.name}</h3>
                  <span className="mt-1 block font-mono text-[10px] uppercase text-muted">{b.count}</span>
                </Link>
              ))}
            </div>
          </section>
          ) : null}
        </>
      )}

      {/* ---------------------------------------------------------------- Bespoke presentation */}
      <section aria-labelledby="bespoke-heading" className="mt-sp-5 border-y border-line bg-surface">
        <div className="mx-auto grid w-full max-w-page gap-sp-4 px-margin py-sp-5 sm:px-margin-tablet lg:grid-cols-[1fr_1fr] lg:px-margin-desktop">
          <div>
            <span className="font-mono text-[11px] uppercase text-muted">The Atelier</span>
            <h2 id="bespoke-heading" className="mt-1 font-display text-headline-lg uppercase text-ink">
              Made-to-Measure, In-House
            </h2>
            <p className="mt-2 max-w-[52ch] font-sans text-body-md text-on-surface-variant">
              Bespoke garments are cut and finished by our in-house atelier in Ahmedabad — measured,
              fitted and delivered through the boutique at Sindhu Bhavan Road. Each commission is
              built to your measurements rather than a size chart.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/collections/bespoke"
                className="inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-ink/85"
              >
                View Bespoke Pieces
              </Link>
              <Link
                href="/support"
                className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-surface-container"
              >
                Speak to the Atelier
              </Link>
            </div>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            <li className="border border-line bg-canvas p-4">
              <h3 className="font-mono text-label-caps uppercase text-ink">Measured, not sized</h3>
              <p className="mt-1 font-sans text-body-sm text-on-surface-variant">
                Commissions start from your measurements, recorded at the boutique or shared with
                the atelier — never interpolated from a standard size.
              </p>
            </li>
            <li className="border border-line bg-canvas p-4">
              <h3 className="font-mono text-label-caps uppercase text-ink">Fitted in person</h3>
              <p className="mt-1 font-sans text-body-sm text-on-surface-variant">
                Fittings and collection happen at the boutique. You deal with the makers directly,
                not a marketplace intermediary.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* D2/D7: the inspection, price-index and concierge programme belongs to the gated resale
          and AI layer. With NEXT_PUBLIC_ENABLE_RESALE=false this block is not rendered at all,
          so the storefront never advertises a marketplace it is not running. */}
      {resaleOn ? (
      <section className="border-b border-line bg-surface-container/20 py-sp-5">
        <div className="mx-auto w-full max-w-page px-margin sm:px-margin-tablet lg:px-margin-desktop space-y-8">
          <div className="text-center max-w-xl mx-auto">
            <span className="font-mono text-xs uppercase text-accent font-semibold tracking-wider">
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
              <h3 className="font-mono text-xs uppercase font-semibold text-ink">
                360° Physical Lab Inspection
              </h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Multi-angle turntable photography and a manual review of box labelling, size
                tags, stitching, sole tooling and material feel against the brand's own
                reference — recorded as a real inspection record per unit.
              </p>
            </div>

            {aiOn ? (
            <div className="border border-line bg-surface p-5 space-y-2">
              <h3 className="font-mono text-xs uppercase font-semibold text-ink">
                The Price Index
              </h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Size-specific secondary trade history with 30-day volatility curves, lowest active asks, and live buyer bids with zero hidden fees.
              </p>
            </div>
            ) : null}

            {fitStudioOn ? (
            <div className="border border-line bg-surface p-5 space-y-2">
              <h3 className="font-mono text-xs uppercase font-semibold text-ink">
                Fit Studio Sizing Engine
              </h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Metric foot length in millimetres mapped against silhouette toe-box geometry, so a
                size is chosen from measurements rather than guesswork.
              </p>
            </div>
            ) : null}

            {aiOn ? (
            <div className="border border-line bg-surface p-5 space-y-2">
              <h3 className="font-mono text-xs uppercase font-semibold text-ink">
                Style Concierge
              </h3>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Conversational stylist assembling streetwear rotations grounded in real-time catalogue inventory.
              </p>
            </div>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}
    </main>
  );
}
