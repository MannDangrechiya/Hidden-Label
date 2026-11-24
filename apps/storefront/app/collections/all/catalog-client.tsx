"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { addToCart } from "@/app/actions/cart";
import type { StoreProduct } from "@/lib/medusa";
import {
  APPAREL_SIZES,
  CATEGORIES,
  PRICE_BUCKETS,
  brandOf,
  isShoeSize,
  matchesCategory,
  matchesPriceBucket,
  normaliseSize,
  productHasAnySize,
  productPriceRupees,
  productSizes,
  type CategoryKey,
} from "@/lib/catalog";

interface CatalogClientProps {
  initialProducts: StoreProduct[];
  initialSizeFilter?: string;
  initialCategory?: CategoryKey;
  initialSort?: "trending" | "newest" | "price_asc" | "price_desc";
  totalCount?: number;
  currentPage?: number;
  totalPages?: number;
  basePath?: string;
}

function initialSizeTokens(filter?: string): string[] {
  const token = normaliseSize(filter);
  return token && token !== "ALL" ? [token] : [];
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function CatalogClient({
  initialProducts,
  initialSizeFilter,
  initialCategory = "all",
  initialSort = "trending",
  totalCount,
  currentPage = 1,
  totalPages = 1,
  basePath = "/collections/all",
}: CatalogClientProps) {
  const [category, setCategory] = useState<CategoryKey>(initialCategory);
  const [brands, setBrands] = useState<string[]>([]);
  const [priceBuckets, setPriceBuckets] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>(initialSizeTokens(initialSizeFilter));
  const [sortBy, setSortBy] = useState<"trending" | "newest" | "price_asc" | "price_desc">(initialSort);
  const [quickViewProduct, setQuickViewProduct] = useState<StoreProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [addingToBag, setAddingToBag] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  /**
   * Option lists come from the catalogue itself: a size or brand filter is only offered when at
   * least one product actually carries it, so a tab can never filter to an empty result set by
   * construction of the UI.
   */
  const { apparelSizes, shoeSizes, otherSizes, brandOptions } = useMemo(() => {
    const apparel = new Set<string>();
    const shoes = new Set<string>();
    const other = new Set<string>();
    const brandSet = new Set<string>();

    for (const product of initialProducts) {
      for (const size of productSizes(product)) {
        if (isShoeSize(size)) shoes.add(size);
        else if ((APPAREL_SIZES as readonly string[]).includes(size)) apparel.add(size);
        else other.add(size);
      }
      const brand = brandOf(product);
      if (brand) brandSet.add(brand);
    }

    const sortSizes = (values: Set<string>, order?: readonly string[]) =>
      Array.from(values).sort((a, b) => {
        if (order) {
          const indexA = order.indexOf(a.toUpperCase());
          const indexB = order.indexOf(b.toUpperCase());
          if (indexA !== -1 || indexB !== -1) return indexA - indexB;
        }
        return a.localeCompare(b, undefined, { numeric: true });
      });

    return {
      apparelSizes: sortSizes(apparel, APPAREL_SIZES),
      shoeSizes: sortSizes(shoes),
      otherSizes: sortSizes(other),
      brandOptions: Array.from(brandSet).sort((a, b) => a.localeCompare(b)),
    };
  }, [initialProducts]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<CategoryKey, number>();
    for (const entry of CATEGORIES) {
      counts.set(
        entry.key,
        initialProducts.filter((product) => matchesCategory(product, entry.key)).length,
      );
    }
    return counts;
  }, [initialProducts]);

  const filtered = useMemo(() => {
    const rows = initialProducts.filter((product) => {
      if (!matchesCategory(product, category)) return false;

      if (brands.length > 0) {
        const brand = brandOf(product);
        if (!brand || !brands.includes(brand)) return false;
      }

      if (priceBuckets.length > 0) {
        const inAnyBucket = priceBuckets.some((bucket) => matchesPriceBucket(product, bucket));
        if (!inAnyBucket) return false;
      }

      if (sizes.length > 0 && !productHasAnySize(product, sizes)) return false;

      return true;
    });

    return rows.sort((a, b) => {
      if (sortBy === "newest") {
        const stampA = a.created_at ? Date.parse(a.created_at) : null;
        const stampB = b.created_at ? Date.parse(b.created_at) : null;
        if (stampA === null && stampB === null) return 0;
        if (stampA === null) return 1;
        if (stampB === null) return -1;
        return stampB - stampA;
      }
      if (sortBy === "trending") return 0;
      const priceA = productPriceRupees(a);
      const priceB = productPriceRupees(b);
      // Products without a real price stay at the end instead of being given a made-up figure.
      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      return sortBy === "price_asc" ? priceA - priceB : priceB - priceA;
    });
  }, [initialProducts, category, brands, priceBuckets, sizes, sortBy]);

  const activeFilters =
    (category === "all" ? 0 : 1) + brands.length + priceBuckets.length + sizes.length;

  function reset() {
    setCategory("all");
    setBrands([]);
    setPriceBuckets([]);
    setSizes([]);
  }

  const toggleClass = (active: boolean) =>
    [
      "min-h-9 border px-3 font-mono text-label-caps uppercase tracking-[0.08em] transition-colors",
      active
        ? "border-ink bg-ink text-white"
        : "border-line bg-surface text-muted hover:border-ink hover:text-ink",
    ].join(" ");

  return (
    <div className="flex flex-col gap-sp-4">
      {/* Category tabs */}
      <nav aria-label="Product categories" className="-mx-margin border-b border-line px-margin pb-3 sm:mx-0 sm:px-0">
        <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1">
          {CATEGORIES.map((entry) => {
            const active = category === entry.key;
            const count = categoryCounts.get(entry.key) ?? 0;
            return (
              <li key={entry.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setCategory(entry.key)}
                  aria-pressed={active}
                  className={[
                    "flex min-h-11 items-center gap-2 border px-4 font-mono text-label-caps uppercase tracking-[0.12em] transition-colors",
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-on-surface-variant hover:border-ink hover:text-ink",
                  ].join(" ")}
                >
                  {entry.label}
                  <span className={active ? "text-white/70" : "text-muted"}>{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Facets */}
      <div className="grid grid-cols-1 gap-sp-3 border border-line bg-surface p-sp-3 lg:grid-cols-[1fr_1fr_1.1fr]">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-label-caps uppercase text-muted">Price</span>
          <div className="flex flex-wrap gap-2">
            {PRICE_BUCKETS.map((bucket) => (
              <button
                key={bucket.key}
                type="button"
                aria-pressed={priceBuckets.includes(bucket.key)}
                onClick={() => setPriceBuckets((current) => toggle(current, bucket.key))}
                className={toggleClass(priceBuckets.includes(bucket.key))}
              >
                {bucket.label}
              </button>
            ))}
          </div>
          <label className="mt-1 flex flex-col gap-1">
            <span className="font-mono text-label-caps uppercase text-muted">Sort</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              className="h-10 border border-line bg-surface px-2 font-mono text-body-sm text-ink outline-none focus:border-ink"
            >
              <option value="trending">Featured order</option>
              <option value="newest">Newest first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-label-caps uppercase text-muted">Apparel sizes</span>
            <div className="flex flex-wrap gap-1.5">
              {apparelSizes.length === 0 ? (
                <span className="font-sans text-body-sm text-muted">No apparel in the catalogue yet.</span>
              ) : (
                apparelSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={sizes.includes(size)}
                    onClick={() => setSizes((current) => toggle(current, size))}
                    className={[toggleClass(sizes.includes(size)), "min-w-11 justify-center"].join(" ")}
                  >
                    {size}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-label-caps uppercase text-muted">Shoe sizes</span>
            <div className="flex flex-wrap gap-1.5">
              {shoeSizes.length === 0 ? (
                <span className="font-sans text-body-sm text-muted">No footwear in the catalogue yet.</span>
              ) : (
                shoeSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={sizes.includes(size)}
                    onClick={() => setSizes((current) => toggle(current, size))}
                    className={[toggleClass(sizes.includes(size)), "min-w-14 justify-center"].join(" ")}
                  >
                    {size}
                  </button>
                ))
              )}
            </div>
          </div>

          {otherSizes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-label-caps uppercase text-muted">Other sizes</span>
              <div className="flex flex-wrap gap-1.5">
                {otherSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={sizes.includes(size)}
                    onClick={() => setSizes((current) => toggle(current, size))}
                    className={toggleClass(sizes.includes(size))}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-label-caps uppercase text-muted">
            Brands ({brands.length === 0 ? "all" : `${brands.length} selected`})
          </span>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {brandOptions.map((brand) => (
              <button
                key={brand}
                type="button"
                aria-pressed={brands.includes(brand)}
                onClick={() => setBrands((current) => toggle(current, brand))}
                className={toggleClass(brands.includes(brand))}
              >
                {brand}
              </button>
            ))}
          </div>
          <p className="font-sans text-body-sm text-muted">
            In-house bespoke sits alongside the imported labels — filter several brands at once.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-label-caps uppercase text-muted">
        <span>
          {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
          {activeFilters > 0 ? ` · ${activeFilters} ${activeFilters === 1 ? "filter" : "filters"}` : ""}
          {" · "}
          <span className="text-ink">
            {CATEGORIES.find((entry) => entry.key === category)?.label ?? "All"}
          </span>
        </span>
        {activeFilters > 0 ? (
          <button type="button" onClick={reset} className="underline underline-offset-4 hover:text-ink">
            Reset filters
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border border-line px-6 py-12">
          <p className="font-display text-headline-sm uppercase">Nothing in this edit yet</p>
          <p className="max-w-[52ch] font-sans text-body-sm text-on-surface-variant">
            No piece matches this combination of category, price, size and brand. Clear a filter or
            browse the full catalogue — the boutique can also source sizes on request.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
              className="min-h-11 border border-ink bg-ink px-5 font-mono text-label-caps uppercase tracking-[0.12em] text-white transition-colors hover:bg-accent hover:text-ink"
            >
              Reset filters
            </button>
            <Link
              href="/brands"
              className="flex min-h-11 items-center border border-ink px-5 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-ink hover:text-white"
            >
              Browse brands
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => {
            const price = productPriceRupees(product);
            const formattedPrice = price === null ? "Price unavailable" : formatINR(moneyFromRupees(price));
            const brand = brandOf(product);
            const variantCount = product.variants?.length ?? 0;
            const hasBespoke = matchesCategory(product, "bespoke");

            return (
              <Link
                key={product.id}
                href={`/products/${product.handle}`}
                className="group flex flex-col border border-line bg-surface p-3 no-underline transition-colors hover:border-ink sm:p-4"
              >
                <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden bg-surface-container">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt={product.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono text-label-caps uppercase text-muted">
                      Image pending
                    </div>
                  )}
                  {hasBespoke ? (
                    <span className="absolute left-0 top-0 border border-ink bg-ink px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white">
                      Made to measure
                    </span>
                  ) : null}
                </div>

                {brand ? (
                  <span className="truncate font-mono text-label-caps uppercase text-muted">{brand}</span>
                ) : null}
                <h3 className="truncate font-display text-headline-sm uppercase text-ink group-hover:underline">
                  {product.title}
                </h3>

                <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] uppercase text-muted">Price</span>
                    <span className="font-mono text-currency-md tabular text-ink">{formattedPrice}</span>
                  </div>
                  <span className="font-mono text-label-caps uppercase text-muted">
                    {variantCount} {variantCount === 1 ? "size" : "sizes"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setQuickViewProduct(product);
                    setSelectedVariantId(product.variants?.[0]?.id ?? null);
                    setAddSuccess(false);
                    setAddError(null);
                  }}
                  className="mt-3 w-full border border-line py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:border-ink hover:text-ink hover:bg-surface-container transition-colors"
                >
                  Quick View
                </button>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Catalogue pagination"
          className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6"
        >
          <Link
            href={`${basePath}?page=${currentPage - 1}${initialSizeFilter ? `&size=${encodeURIComponent(initialSizeFilter)}` : ""}`}
            className={`flex min-h-11 items-center border px-4 font-mono text-label-caps uppercase tracking-[0.1em] transition-colors ${
              currentPage <= 1
                ? "pointer-events-none opacity-40 border-line text-muted"
                : "border-line bg-surface text-ink hover:border-ink hover:bg-surface-container"
            }`}
            aria-disabled={currentPage <= 1}
          >
            ← Previous Page
          </Link>

          <span className="font-mono text-xs uppercase text-muted">
            Page {currentPage} of {totalPages}
            {totalCount !== undefined ? ` · ${totalCount} Total Items` : ""}
          </span>

          <Link
            href={`${basePath}?page=${currentPage + 1}${initialSizeFilter ? `&size=${encodeURIComponent(initialSizeFilter)}` : ""}`}
            className={`flex min-h-11 items-center border px-4 font-mono text-label-caps uppercase tracking-[0.1em] transition-colors ${
              currentPage >= totalPages
                ? "pointer-events-none opacity-40 border-line text-muted"
                : "border-line bg-surface text-ink hover:border-ink hover:bg-surface-container"
            }`}
            aria-disabled={currentPage >= totalPages}
          >
            Next Page →
          </Link>
        </nav>
      )}

      {quickViewProduct ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
          onClick={() => setQuickViewProduct(null)}
        >
          <div
            className="relative flex w-full max-w-lg flex-col border border-line bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQuickViewProduct(null)}
              className="absolute right-4 top-4 font-mono text-sm text-muted hover:text-ink"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="flex gap-4">
              <div className="h-32 w-24 flex-none bg-surface-container">
                {quickViewProduct.thumbnail ? (
                  <img
                    src={quickViewProduct.thumbnail}
                    alt={quickViewProduct.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-label-caps uppercase text-muted">
                  {brandOf(quickViewProduct) ?? "The Hidden Label"}
                </span>
                <h2 className="font-display text-headline-sm uppercase text-ink mt-1">
                  {quickViewProduct.title}
                </h2>
                <span className="font-mono text-currency-md tabular text-ink mt-2">
                  {(() => {
                    const price = productPriceRupees(quickViewProduct);
                    return price !== null ? formatINR(moneyFromRupees(price)) : "Price unavailable";
                  })()}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <span className="font-mono text-label-caps uppercase text-muted">Select size</span>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                {(quickViewProduct.variants ?? []).map((v) => {
                  const isSelected = v.id === selectedVariantId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`min-h-10 border px-3 py-1 font-mono text-xs uppercase transition-colors ${
                        isSelected
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-surface text-ink hover:border-ink"
                      }`}
                    >
                      {v.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {addError ? (
              <p className="mt-3 font-sans text-xs text-negative">{addError}</p>
            ) : null}

            {addSuccess ? (
              <div className="mt-4 flex items-center justify-between border border-line bg-surface-container p-3">
                <span className="font-mono text-xs text-ink">Added to bag</span>
                <Link
                  href="/cart"
                  className="font-mono text-xs uppercase text-ink underline hover:text-muted"
                >
                  View bag →
                </Link>
              </div>
            ) : (
              <button
                type="button"
                disabled={addingToBag || !selectedVariantId}
                onClick={async () => {
                  if (!selectedVariantId) return;
                  setAddingToBag(true);
                  setAddError(null);
                  try {
                    const res = await addToCart(selectedVariantId, 1);
                    if (!res.ok) {
                      setAddError(res.message ?? "Could not add to bag.");
                    } else {
                      setAddSuccess(true);
                    }
                  } catch {
                    setAddError("Could not add to bag.");
                  } finally {
                    setAddingToBag(false);
                  }
                }}
                className="mt-6 w-full border border-ink bg-ink py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white hover:bg-accent hover:text-ink disabled:opacity-50 transition-colors"
              >
                {addingToBag ? "Adding…" : "Add to bag"}
              </button>
            )}

            <Link
              href={`/products/${quickViewProduct.handle}`}
              onClick={() => setQuickViewProduct(null)}
              className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:text-ink underline"
            >
              View full details →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
