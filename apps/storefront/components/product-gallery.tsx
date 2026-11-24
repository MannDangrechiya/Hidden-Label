"use client";

import { useState } from "react";

/**
 * Product gallery built exclusively from imagery the backend actually supplies. If Medusa
 * returns several `images`, the customer can switch between real views; if there is only one
 * image (or none), the gallery never invents extra "angles" by repeating the same file.
 */
export function ProductGallery({
  title,
  thumbnail,
  images,
}: {
  title: string;
  thumbnail: string | null;
  images?: { id: string; url: string }[] | null;
}) {
  // De-duplicate real image URLs against the thumbnail: Medusa often lists the thumbnail as
  // the first image, and presenting the same file twice would fake a second angle.
  const seen = new Set<string>();
  const views: string[] = [];
  for (const url of [thumbnail, ...(images ?? []).map((image) => image.url)]) {
    if (url && !seen.has(url)) {
      seen.add(url);
      views.push(url);
    }
  }

  const [active, setActive] = useState(0);
  const current = views[Math.min(active, views.length - 1)] ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-container">
        {current ? (
          <img
            src={current}
            alt={views.length > 1 ? `${title} — view ${active + 1} of ${views.length}` : title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-label-caps uppercase text-muted">
            Image pending
          </div>
        )}
      </div>

      {views.length > 1 ? (
        <div role="group" aria-label={`${title} image views`} className="flex gap-2 overflow-x-auto pb-1">
          {views.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={index === active}
              aria-label={`Show image ${index + 1} of ${views.length}`}
              className={[
                "h-16 w-12 shrink-0 overflow-hidden border-2 bg-surface-container transition-colors",
                index === active ? "border-ink" : "border-line hover:border-muted",
              ].join(" ")}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
