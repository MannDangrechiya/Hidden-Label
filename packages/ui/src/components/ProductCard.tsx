import type { Money } from "@thl/shared";
import { Badge, type BadgeKind } from "./Badge";
import { Price } from "./Price";

export interface ProductCardProps {
  brand: string | null;
  title: string;
  price: Money | null;
  imageUrl: string | null;
  href?: string;
  badge?: BadgeKind | null;
  /** True when no variant is purchasable — the card states it rather than hiding the product. */
  soldOut?: boolean;
}

/**
 * DESIGN_TOKENS.md §5: 3:4 image on the container surface, brand in label-caps at #71717A,
 * title in Hanken Grotesk medium, price in JetBrains Mono. The card never lifts on hover —
 * hover is handled by the image swap and size bar in Phase 4.
 */
export function ProductCard({
  brand,
  title,
  price,
  imageUrl,
  href,
  badge = null,
  soldOut = false,
}: ProductCardProps) {
  // A sold-out product always states it, regardless of the badge passed in.
  const badgeKind: BadgeKind | null = soldOut ? "sold_out" : badge;

  const content = (
    <article className="group flex flex-col">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-container">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-opacity duration-200"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-label-caps uppercase text-muted">
            No image
          </div>
        )}
        {badgeKind ? (
          <div className="absolute left-2 top-2">
            <Badge kind={badgeKind} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 pt-3">
        {brand ? (
          <span className="font-mono text-label-caps uppercase text-muted">{brand}</span>
        ) : null}
        <span className="font-sans text-body-md font-medium text-ink">{title}</span>
        <Price value={price} />
      </div>
    </article>
  );

  return href ? (
    <a href={href} className="focus-visible:outline focus-visible:outline-1 focus-visible:outline-ink">
      {content}
    </a>
  ) : (
    content
  );
}
