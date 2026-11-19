"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoreCategoryNode } from "@/lib/medusa";

interface Brand {
  id: string;
  name: string;
  handle: string;
}

/**
 * U-02 mega-menu: the real `product_category` tree (via `/store/categories`) plus a short brand
 * list, replacing the flat "Shop"/"Brands" header links with an overlay. Falls back to those
 * plain links if the category tree is empty (e.g. a fresh environment before seeding).
 */
export function MegaMenu({ categories, brands }: { categories: StoreCategoryNode[]; brands: Brand[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (categories.length === 0) {
    return (
      <Link
        href="/collections/all"
        className="font-mono text-label-caps uppercase text-on-surface-variant no-underline transition-colors hover:text-ink"
      >
        Shop
      </Link>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        // A toggle here would fight the hover handlers above on a real mouse (hover opens it,
        // then the click that follows the pointer there would immediately close it again) — a
        // tap-only device never fires onMouseEnter, so "always open" is correct for both.
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="font-mono text-label-caps uppercase text-on-surface-variant no-underline transition-colors hover:text-ink"
      >
        Shop
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Shop by category"
          className="absolute left-1/2 top-full z-40 mt-3 w-[min(90vw,720px)] -translate-x-1/2 border border-ink bg-white p-sp-4 shadow-lg"
        >
          <div className="grid grid-cols-2 gap-sp-4 sm:grid-cols-3">
            {categories.map((category) => (
              <div key={category.id}>
                <Link
                  href={`/collections/all?category=${encodeURIComponent(category.handle)}`}
                  onClick={() => setOpen(false)}
                  className="font-mono text-label-caps uppercase text-ink no-underline hover:underline"
                >
                  {category.name}
                  {category.product_count > 0 ? (
                    <span className="ml-1 text-muted">({category.product_count})</span>
                  ) : null}
                </Link>
                {category.children.length > 0 ? (
                  <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/collections/all?category=${encodeURIComponent(child.handle)}`}
                          onClick={() => setOpen(false)}
                          className="font-sans text-body-sm text-on-surface-variant no-underline hover:text-ink hover:underline"
                        >
                          {child.name}
                          {child.product_count > 0 ? (
                            <span className="ml-1 text-muted">({child.product_count})</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>

          {brands.length > 0 ? (
            <div className="mt-sp-4 border-t border-line pt-sp-3">
              <p className="mb-2 font-mono text-label-caps uppercase text-muted">Brands</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {brands.slice(0, 10).map((brand) => (
                  <Link
                    key={brand.id}
                    href={`/brands/${brand.handle}`}
                    onClick={() => setOpen(false)}
                    className="font-sans text-body-sm text-ink no-underline hover:underline"
                  >
                    {brand.name}
                  </Link>
                ))}
                <Link
                  href="/brands"
                  onClick={() => setOpen(false)}
                  className="font-mono text-label-caps uppercase text-muted no-underline hover:text-ink hover:underline"
                >
                  View all →
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
