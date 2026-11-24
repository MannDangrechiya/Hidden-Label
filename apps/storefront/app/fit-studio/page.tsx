import Link from "next/link";
import { notFound } from "next/navigation";
import { FitStudioWidget } from "@/components/fit-studio-widget";
import { fitStudioEnabled } from "@/lib/feature-flags";

export const metadata = {
  title: "Fit Studio — Precision Metric Footwear Sizing | The Hidden Label",
  description: "Calculate your optimal sneaker size across Air Jordan 1, Adidas Samba, New Balance 990, and Salomon silhouettes.",
};

const SILHOUETTES = [
  { title: "Air Jordan 1 Retro High OG 'Chicago'", handle: "air-jordan-1-retro-high-og-chicago" },
  { title: "Samba OG 'Cloud White'", handle: "samba-og-cloud-white" },
  { title: "Dunk Low 'Panda'", handle: "dunk-low-panda" },
  { title: "990v6 'Grey'", handle: "990v6-grey" },
];

export default function FitStudioPage() {
  // Add-on: opened only once NEXT_PUBLIC_FEATURE_FIT_STUDIO is explicitly enabled.
  if (!fitStudioEnabled()) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <div className="mb-8 border-b border-line pb-6">
        <span className="font-mono text-label-caps uppercase text-muted">Sizing</span>
        <h1 className="mt-1 font-display text-headline-xl uppercase text-ink">
          The Fit Studio
        </h1>
        <p className="mt-2 font-sans text-sm text-on-surface-variant max-w-2xl leading-relaxed">
          Sneaker lasts vary drastically across manufacturers. A UK 8.0 in an Adidas terrace shoe will not fit the same as a UK 8.0 in an American runner. Our Fit Studio analyzes foot length in millimeters alongside silhouette volume metrics to compute your precise size.
        </p>
      </div>

      <div className="grid gap-6">
        {SILHOUETTES.map((s) => (
          <div key={s.handle} className="border border-line bg-surface p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-display text-base uppercase text-ink">{s.title}</h3>
              <Link
                href={`/products/${s.handle}`}
                className="font-mono text-xs uppercase underline text-muted hover:text-ink"
              >
                View Silhouette →
              </Link>
            </div>
            <FitStudioWidget productTitle={s.title} productHandle={s.handle} />
          </div>
        ))}
      </div>
    </main>
  );
}
