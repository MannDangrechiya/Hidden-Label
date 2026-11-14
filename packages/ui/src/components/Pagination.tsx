import type { ReactNode } from "react";

export interface LoadMoreProps {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  /** Server-component usage: a form/button is passed in instead of a click handler. */
  action?: ReactNode;
  shown: number;
  total: number;
}

/**
 * Additive primitive. DESIGN_TOKENS.md §4 circles are reserved for pagination dots; this is the
 * "load more" pattern used by the catalogue and brand grids instead of numbered pages.
 */
export function LoadMore({ hasMore, loading = false, onLoadMore, action, shown, total }: LoadMoreProps) {
  return (
    <div className="mt-lg flex flex-col items-center gap-2">
      <p className="font-mono text-label-caps uppercase text-muted">
        Showing {shown} of {total}
      </p>
      {hasMore ? (
        action ?? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            aria-busy={loading || undefined}
            className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:text-muted"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )
      ) : null}
    </div>
  );
}

export interface PageDotsProps {
  count: number;
  current: number;
}

/** The one place a filled circle is permitted (DESIGN_TOKENS.md §4). */
export function PageDots({ count, current }: PageDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Pages">
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          role="tab"
          aria-selected={index === current}
          className={["h-2 w-2 rounded-full", index === current ? "bg-ink" : "bg-line"].join(" ")}
        />
      ))}
    </div>
  );
}
