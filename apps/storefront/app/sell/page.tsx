import { getCurrentCustomer } from "@/lib/session";
import { fetchProducts } from "@/lib/medusa";
import { SellClient } from "./sell-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sell & Consign Authenticated Sneakers | The Hidden Label",
  description: "Turn your sneaker collection into cash. List in 60 seconds with 0 upfront fees. Every pair is authenticated in our lab with guaranteed payouts.",
};

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; size?: string }>;
}) {
  const resolvedParams = await searchParams;
  const session = await getCurrentCustomer().catch(() => null);
  const { products } = await fetchProducts({ limit: 50 }).catch(() => ({ products: [] }));

  return (
    <main className="mx-auto w-full max-w-page px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
      {/* Editorial Header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-widest text-emerald-600 font-bold mb-2">
          Consignment &amp; Secondary Marketplace
        </p>
        <h1 className="font-display text-headline-xl sm:text-headline-2xl uppercase tracking-tight text-ink mb-3">
          Sell on The Hidden Label
        </h1>
        <p className="font-sans text-sm text-on-surface-variant">
          Connect with India&rsquo;s largest verified sneaker audience. 0 upfront listing fees. Fast payouts upon physical lab authentication.
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
