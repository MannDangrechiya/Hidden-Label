"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatINR, moneyFromRupees } from "@thl/shared";
import type { StoreProduct } from "@/lib/medusa";

interface CatalogClientProps {
  initialProducts: StoreProduct[];
  initialSizeFilter?: string;
}

export function CatalogClient({ initialProducts, initialSizeFilter }: CatalogClientProps) {
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedSize, setSelectedSize] = useState<string>(initialSizeFilter ?? "all");
  const [sortBy, setSortBy] = useState<"trending" | "price_asc" | "price_desc">("trending");

  const brands = useMemo(() => {
    const set = new Set<string>();
    initialProducts.forEach((p) => {
      const b = typeof p.metadata?.brand === "string" ? p.metadata.brand : null;
      if (b) set.add(b);
    });
    return ["all", ...Array.from(set)];
  }, [initialProducts]);

  const sizes = ["all", "UK 7.0", "UK 8.0", "UK 8.5", "UK 9.0", "UK 9.5", "UK 10.0", "UK 11.0"];

  const filtered = useMemo(() => {
    return initialProducts
      .filter((p) => {
        // Brand filter
        if (selectedBrand !== "all") {
          const brand = typeof p.metadata?.brand === "string" ? p.metadata.brand : "";
          if (brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
        }
        // Size filter
        if (selectedSize !== "all") {
          const hasSize = (p.variants ?? []).some((v) =>
            v.title?.toLowerCase().includes(selectedSize.toLowerCase()),
          );
          if (!hasSize) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = a.variants?.[0]?.calculated_price?.calculated_amount ?? 15000;
        const priceB = b.variants?.[0]?.calculated_price?.calculated_amount ?? 15000;
        if (sortBy === "price_asc") return priceA - priceB;
        if (sortBy === "price_desc") return priceB - priceA;
        return 0; // trending (default)
      });
  }, [initialProducts, selectedBrand, selectedSize, sortBy]);

  return (
    <div className="space-y-6">
      {/* Filter and Sort Toolbar */}
      <div className="flex flex-col gap-4 border-b border-line pb-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Brand Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs uppercase text-muted mr-1">Brand:</span>
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setSelectedBrand(b)}
              className={`px-3 py-1 font-mono text-xs uppercase border transition-colors ${
                selectedBrand === b
                  ? "border-ink bg-ink text-surface"
                  : "border-line text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Size Filter & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs uppercase text-muted">Size:</span>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink focus:border-ink focus:outline-none"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All Sizes" : s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs uppercase text-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink focus:border-ink focus:outline-none"
            >
              <option value="trending">Trending Market Value</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Results Count */}
      <div className="flex items-center justify-between text-xs font-mono text-muted">
        <span>Showing {filtered.length} silhouettes</span>
        {(selectedBrand !== "all" || selectedSize !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSelectedBrand("all");
              setSelectedSize("all");
            }}
            className="underline hover:text-ink"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="border border-line p-12 text-center font-mono text-xs text-muted">
          No silhouettes match your selected filter criteria. Try resetting filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => {
            const amount = product.variants?.[0]?.calculated_price?.calculated_amount;
            const price = amount !== null && amount !== undefined ? moneyFromRupees(amount) : null;
            const brand = typeof product.metadata?.brand === "string" ? product.metadata.brand : "Sneaker Vault";
            // D2: never fabricate a price when the real calculated price is missing.
            const formattedPrice = price ? formatINR(price) : "Price unavailable";
            const variantCount = product.variants?.length ?? 1;

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
                  {/* D2: no blanket "Verified" claim or fabricated trend % here — the real
                      per-unit authentication status lives on the product page and only
                      renders when a real approved inspection record exists. */}
                </div>

                <span className="font-mono text-[10px] uppercase text-muted truncate">
                  {brand}
                </span>
                <h3 className="font-display text-xs sm:text-sm uppercase text-ink font-semibold truncate group-hover:underline">
                  {product.title}
                </h3>

                <div className="mt-2 pt-2 border-t border-line/60 flex items-baseline justify-between">
                  <div>
                    <span className="block font-mono text-[9px] uppercase text-muted">Price</span>
                    <span className="font-sans text-sm font-bold text-ink">{formattedPrice}</span>
                  </div>
                  <span className="font-mono text-[10px] uppercase text-muted">
                    {variantCount} Sizes
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
