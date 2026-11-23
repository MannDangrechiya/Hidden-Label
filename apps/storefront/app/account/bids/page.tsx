import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/session";
import { listMyBids } from "@/lib/resale";
import { CustomerBidsClient } from "./bids-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Marketplace Bids | The Hidden Label",
};

export default async function CustomerBidsPage() {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  const biddingEnabled = process.env.NEXT_PUBLIC_FEATURE_BIDDING === "true";

  // No backend call at all while bidding is switched off — the previous implementation hit a
  // hardcoded localhost origin and rendered its result on a page that only shows a notice.
  const bids = biddingEnabled ? await listMyBids(session.token) : [];

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <div className="mb-6 flex flex-wrap items-center justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/account" className="font-mono text-xs uppercase text-muted hover:text-ink">
              ← Account
            </Link>
            <span className="text-muted">/</span>
            <span className="font-mono text-xs uppercase text-ink">Bids &amp; Offers</span>
          </div>
          <h1 className="mt-2 font-display text-headline-lg uppercase text-ink">
            My Marketplace Bids
          </h1>
          <p className="font-sans text-xs text-muted">
            Track your open offers, matched pairs, and active secondary market orders.
          </p>
        </div>
      </div>

      {!biddingEnabled ? (
        <div className="border border-line bg-surface p-8 text-center space-y-3">
          <p className="font-display text-base uppercase text-ink">Bidding Mode Inactive</p>
          <p className="font-sans text-xs text-muted max-w-md mx-auto">
            Marketplace bidding is currently disabled in this environment. Retail pieces are
            available at the listed price from the collection.
          </p>
          <Link
            href="/collections/all"
            className="inline-flex min-h-12 items-center justify-center border border-ink bg-ink px-6 py-3 font-mono text-xs uppercase text-white hover:bg-ink/90 no-underline"
          >
            Browse The Vault
          </Link>
        </div>
      ) : (
        <CustomerBidsClient initialBids={bids} token={session.token} />
      )}
    </main>
  );
}
