import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/session";
import { CustomerAsksClient } from "./asks-client";
import { listMyAsks } from "@/lib/resale";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Consignments & Asks | The Hidden Label",
};

export default async function CustomerAsksPage() {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  const asks = await listMyAsks(session.token);

  return (
    <main className="mx-auto w-full max-w-page px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
      <div className="mb-6 flex flex-wrap items-center justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/account" className="font-mono text-xs uppercase text-muted hover:text-ink">
              ← Account
            </Link>
            <span className="text-muted">/</span>
            <span className="font-mono text-xs uppercase text-ink">My Consignments</span>
          </div>
          <h1 className="mt-2 font-display text-headline-lg uppercase text-ink">
            My Consignments &amp; Asks
          </h1>
          <p className="font-sans text-xs text-muted">
            Manage your listed pairs, asking prices, authentication status, and seller payouts.
          </p>
        </div>
        <Link
          href="/sell"
          className="mt-4 sm:mt-0 inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2 font-mono text-xs uppercase text-surface hover:bg-ink/90 transition-colors"
        >
          <span>+</span> List New Pair
        </Link>
      </div>

      <CustomerAsksClient initialAsks={asks} token={session.token} />
    </main>
  );
}
