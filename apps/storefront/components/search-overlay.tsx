"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBySight } from "@/components/search-by-sight";

interface Suggestion {
  products: { id: string; title: string; handle: string; thumbnail: string | null }[];
  brands: { id: string; name: string; handle: string }[];
}

const EMPTY: Suggestion = { products: [], brands: [] };

/**
 * U-06 Search Overlay — keyboard-navigable typeahead over `/api/search` (itself a same-origin
 * proxy for the custom `/store/search/suggest` route). Enter submits to the full results page
 * (`/search?q=`), which runs the real store product search — this overlay is never the only
 * way to search, so a zero-suggestion state is never a dead end.
 */
export function SearchOverlay() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sightSearchOpen, setSightSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions(EMPTY);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data: Suggestion) => setSuggestions(data))
        .catch(() => setSuggestions(EMPTY))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  function submit() {
    if (!query.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="font-mono text-label-caps uppercase text-ink no-underline"
      >
        Search
      </button>

      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-start justify-center bg-canvas/85 pt-24 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-xl border border-ink bg-white"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
              className="flex items-center border-b border-line"
            >
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, brands, SKUs"
                className="w-full bg-transparent px-4 py-4 font-sans text-body-md text-ink outline-none placeholder:text-muted"
                aria-label="Search query"
              />
              <button
                type="button"
                onClick={() => setSightSearchOpen(true)}
                title="Search by Sight (AI-01)"
                className="flex items-center gap-1 border-l border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-ink hover:bg-surface-container/50 whitespace-nowrap"
              >
                <span>📷</span>
                <span className="hidden sm:inline">Sight</span>
              </button>
              <button
                type="submit"
                className="px-4 font-mono text-label-caps uppercase text-muted hover:text-ink"
              >
                Go
              </button>
            </form>

            {sightSearchOpen ? (
              <div className="p-4 border-t border-line">
                <SearchBySight
                  onClose={() => {
                    setSightSearchOpen(false);
                    setOpen(false);
                  }}
                />
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto p-md">
              {loading ? (
                <p className="font-mono text-label-caps uppercase text-muted">Searching…</p>
              ) : query.trim().length < 2 ? (
                <p className="font-sans text-body-sm text-muted">
                  Keep typing — results appear after two characters.
                </p>
              ) : suggestions.brands.length === 0 && suggestions.products.length === 0 ? (
                <p className="font-sans text-body-sm text-muted">
                  No quick matches. Press enter to search the full catalogue for &ldquo;{query}&rdquo;.
                </p>
              ) : (
                <div className="flex flex-col gap-md">
                  {suggestions.brands.length > 0 ? (
                    <div>
                      <p className="mb-2 font-mono text-label-caps uppercase text-muted">Brands</p>
                      <ul className="m-0 flex list-none flex-col gap-1 p-0">
                        {suggestions.brands.map((brand) => (
                          <li key={brand.id}>
                            <a
                              href={`/brands/${brand.handle}`}
                              className="block py-1 font-sans text-body-md text-ink no-underline hover:underline"
                            >
                              {brand.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {suggestions.products.length > 0 ? (
                    <div>
                      <p className="mb-2 font-mono text-label-caps uppercase text-muted">Products</p>
                      <ul className="m-0 flex list-none flex-col gap-1 p-0">
                        {suggestions.products.map((product) => (
                          <li key={product.id}>
                            <a
                              href={`/products/${product.handle}`}
                              className="flex items-center gap-3 py-1 font-sans text-body-md text-ink no-underline hover:underline"
                            >
                              <span className="h-10 w-8 flex-none bg-surface-container">
                                {product.thumbnail ? (
                                  <img
                                    src={product.thumbnail}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </span>
                              {product.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
