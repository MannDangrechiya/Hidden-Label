import Link from "next/link";
import { getCurrentCustomer } from "@/lib/session";
import { fetchProducts } from "@/lib/medusa";
import { SellClient } from "./sell-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sell & Consign | The Hidden Label",
  description: "Luxury retail and atelier made-to-measure collections.",
};

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; size?: string }>;
}) {
  if (process.env.NEXT_PUBLIC_ENABLE_RESALE !== "true") {
    return (
      <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
        <div className="max-w-xl mx-auto border border-line bg-surface p-10 text-center space-y-4">
          <p className="font-mono text-label-caps uppercase text-muted">Consignment &amp; Resale</p>
          <h1 className="font-display text-headline-md uppercase text-ink">Consignment Currently Paused</h1>
          <p className="font-sans text-body-sm text-on-surface-variant leading-relaxed">
            Direct consignment and secondary market submissions are currently paused as our atelier focuses on our curated luxury retail vault and bespoke tailoring collections.
          </p>
          <div className="pt-2">
            <Link
              href="/collections/all"
              className="inline-flex min-h-12 items-center justify-center border border-ink bg-ink px-6 py-3 font-mono text-label-caps uppercase text-white hover:bg-ink/90 no-underline transition-colors"
            >
              Explore Retail Vault →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const resolvedParams = await searchParams;
  const session = await getCurrentCustomer().catch(() => null);
  const { products } = await fetchProducts({ limit: 50 }).catch(() => ({ products: [] }));

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      {/* Editorial Header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-widest text-emerald-600 font-bold mb-2">
          Consignment &amp; Secondary Marketplace
        </p>
        <h1 className="font-display text-headline-xl sm:text-headline-2xl uppercase tracking-tight text-ink mb-3">
          Sell on The Hidden Label
        </h1>
        {/* D2: no unverifiable superlative ("largest") and no "guaranteed"/blanket
            authentication claim without an enforced workflow behind it. */}
        <p className="font-sans text-sm text-on-surface-variant">
          Reach buyers on The Hidden Label. 0 upfront listing fees — your listing goes through a
          real inspection and review before it pays out.
        </p>
      </div>

      <SellClient
        products={products}
        initialProductHandle={resolvedParams.product}
        initialSize={resolvedParams.size}
        isLoggedIn={Boolean(session)}
        token={session?.token ?? null}
      />
    </main>
  );
}
