import { formatINR, type Money } from "@thl/shared";
import Link from "next/link";
import type { StoreProduct } from "@/lib/medusa";

/**
 * Shared editorial product card: brand · title · price · availability, image-led with a plain
 * border and no decorative chrome. Availability is computed from real variant stock the caller
 * already resolved (never asserted from a missing field).
 */
export function ProductCardLink({
  product,
  price,
  brand,
  available,
  badge,
}: {
  product: StoreProduct;
  /** Money value from a real calculated price, or null when the backend returned none. */
  price: Money | null;
  brand: string | null;
  available: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={`/products/${product.handle}`}
      className="group flex min-w-0 flex-col border border-line bg-surface no-underline transition-colors hover:border-ink"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-container">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-label-caps uppercase text-muted">
            Image pending
          </div>
        )}
        {badge ? (
          <span className="absolute left-0 top-0 border border-ink bg-ink px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        {brand ? (
          <span className="truncate font-mono text-label-caps uppercase text-muted">{brand}</span>
        ) : null}
        <h3 className="truncate font-display text-headline-sm uppercase leading-tight text-ink">
          {product.title}
        </h3>
        <div className="mt-auto flex items-baseline justify-between border-t border-line pt-2">
          <span className="font-mono text-currency-md tabular text-ink">
            {price === null ? "Price unavailable" : formatINR(price)}
          </span>
          <span
            className={[
              "font-mono text-label-caps uppercase",
              available ? "text-ink" : "text-muted",
            ].join(" ")}
          >
            {available ? "Available" : "Sold out"}
          </span>
        </div>
      </div>
    </Link>
  );
}
