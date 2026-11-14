import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/session";
import { CustomerBidsClient } from "./bids-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Marketplace Bids | The Hidden Label",
};

export default async function CustomerBidsPage() {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  let bids = [];
  try {
    const res = await fetch("http://localhost:9000/store/resale/bids", {
      headers: {
        authorization: `Bearer ${session.token}`,
        "x-publishable-api-key": process.env.MEDUSA_PUBLISHABLE_KEY || "",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      bids = data.bids ?? [];
    }
  } catch {
    bids = [];
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
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

      <CustomerBidsClient initialBids={bids} token={session.token} />
    </main>
  );
}
