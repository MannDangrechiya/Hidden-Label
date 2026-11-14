import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Server components pass a plain anchor renderer; Next.js pages can pass `Link`. */
  renderLink?: (item: BreadcrumbItem, index: number) => ReactNode;
}

/** Additive primitive. Matches the breadcrumb pattern already inlined on the PDP. */
export function Breadcrumb({ items, renderLink }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex list-none flex-wrap gap-2 p-0 font-mono text-label-caps uppercase text-muted">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href && index < items.length - 1 ? (
              renderLink ? (
                renderLink(item, index)
              ) : (
                <a href={item.href} className="text-muted no-underline hover:text-ink">
                  {item.label}
                </a>
              )
            ) : (
              <span className="text-ink">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
