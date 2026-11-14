"use client";

import { useState } from "react";
import Link from "next/link";
import { searchBySight, type SightSearchMatch } from "@/lib/resale";

interface SearchBySightProps {
  onClose?: () => void;
}

export function SearchBySight({ onClose }: SearchBySightProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [silhouetteHint, setSilhouetteHint] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<SightSearchMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const presets = [
    { label: "Air Jordan 1 Chicago", hint: "Jordan", img: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=600&q=80" },
    { label: "Adidas Samba White", hint: "Samba", img: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=600&q=80" },
    { label: "Dunk Low Panda", hint: "Dunk", img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80" },
    { label: "New Balance 990v6", hint: "990v6", img: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=600&q=80" },
  ];

  const handleSearch = async (overrideHint?: string, overrideImg?: string) => {
    const hint = overrideHint !== undefined ? overrideHint : silhouetteHint;
    const img = overrideImg !== undefined ? overrideImg : imageUrl;

    setIsLoading(true);
    setHasSearched(true);
    const results = await searchBySight({
      silhouette_hint: hint || undefined,
      image_url: img || undefined,
    });
    setMatches(results);
    setIsLoading(false);
  };

  return (
    <div className="border border-line bg-surface p-6 max-w-2xl mx-auto shadow-2xl">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-ink" />
            <h3 className="font-mono text-label-caps uppercase text-ink font-semibold">
              Search by Sight (AI-01)
            </h3>
          </div>
          <p className="mt-1 font-sans text-xs text-muted">
            Upload a photo or describe it to find similar silhouettes in our catalogue.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-sm text-muted hover:text-ink px-2 py-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Preset Visual Samples */}
      <div className="my-4">
        <span className="block font-mono text-[11px] uppercase text-muted mb-2">
          Or test with sample photographs:
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setImageUrl(preset.img);
                setSilhouetteHint(preset.hint);
                handleSearch(preset.hint, preset.img);
              }}
              className="border border-line p-2 text-left hover:border-ink transition-colors group"
            >
              <div className="aspect-square w-full overflow-hidden mb-1.5 bg-surface-container">
                <img
                  src={preset.img}
                  alt={preset.label}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <span className="block font-mono text-[10px] text-ink truncate font-medium">
                {preset.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom URL / Hint input */}
      <div className="space-y-3 border-t border-line pt-4">
        <div>
          <label className="block font-mono text-xs uppercase text-muted mb-1">
            Image URL or Silhouette Keyword:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Chicago, Samba, 990v6, or paste image URL..."
              value={silhouetteHint}
              onChange={(e) => setSilhouetteHint(e.target.value)}
              className="flex-1 border border-line bg-surface px-3 py-2 font-mono text-xs text-ink focus:border-ink focus:outline-none"
            />
            <button
              type="button"
              disabled={isLoading || (!silhouetteHint && !imageUrl)}
              onClick={() => handleSearch()}
              className="border border-ink bg-ink px-5 py-2 font-mono text-xs uppercase tracking-wider text-surface hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "Matching..." : "Search"}
            </button>
          </div>
        </div>
      </div>

      {/* Results Matrix */}
      {hasSearched && (
        <div className="mt-6 border-t border-line pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs uppercase text-ink font-semibold">
              Vault Matches ({matches.length})
            </span>
          </div>

          {matches.length === 0 ? (
            <p className="font-mono text-xs text-muted py-4 text-center">
              No direct visual matches found in the current vault catalogue.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {matches.map(({ product, similarity_score }) => (
                <Link
                  key={product.id}
                  href={`/products/${product.handle}`}
                  onClick={onClose}
                  className="flex gap-3 border border-line p-3 hover:border-ink transition-colors no-underline group"
                >
                  <div className="h-16 w-16 flex-shrink-0 bg-surface-container overflow-hidden">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-mono text-[9px] text-muted">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center min-w-0">
                    <span className="font-mono text-[10px] uppercase text-muted truncate">
                      {product.brand}
                    </span>
                    <h4 className="font-display text-xs uppercase text-ink truncate group-hover:underline">
                      {product.title}
                    </h4>
                    <span className="font-mono text-[10px] text-emerald-700 font-semibold mt-1">
                      {Math.round(similarity_score * 100)}% Visual Match
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
