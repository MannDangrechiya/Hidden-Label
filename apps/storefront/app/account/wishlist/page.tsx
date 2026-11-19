import { moneyFromRupees } from "@thl/shared";
import { EmptyState, ErrorState, Price } from "@thl/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { moveWishlistItemToBagAction, removeWishlistAction } from "@/app/actions/account";
import { getCurrentCustomer } from "@/lib/session";
import { fetchProductsForVariants, fetchWishlist, MedusaError } from "@/lib/medusa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved collection" };

export default async function WishlistPage() {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  let rows: { variantId: string; title: string; brand: string | null; href: string; imageUrl: string | null; price: ReturnType<typeof moneyFromRupees> | null }[] = [];
  let error: string | null = null;

  try {
    const items = await fetchWishlist(session.token);
    const byVariant = await fetchProductsForVariants(items.map((item) => item.variant_id));
    rows = items
      .map((item) => {
        const match = byVariant.get(item.variant_id);
        if (!match) return null;
        const amount = match.variant.calculated_price?.calculated_amount;
        return {
          variantId: item.variant_id,
          title: match.product.title,
          brand: typeof match.product.metadata?.brand === "string" ? match.product.metadata.brand : null,
          href: `/products/${match.product.handle}`,
          imageUrl: match.product.thumbnail,
          price: amount === null || amount === undefined ? null : moneyFromRupees(amount),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  } catch (caught) {
    error = caught instanceof MedusaError ? caught.message : "Could not load your saved items.";
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-col gap-2 border-b border-line pb-sp-3">
        <p className="font-mono text-label-caps uppercase text-muted">Saved collection</p>
        <h1 className="type-headline-lg uppercase">Wishlist</h1>
      </header>

      {error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Tap the save icon on any product to keep it here."
          action={
            <Link
              href="/collections/all"
              className="inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
            >
              Shop all
            </Link>
          }
        />
      ) : (
        <ul className="grid list-none grid-cols-2 gap-gutter p-0 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((row) => (
            <li key={row.variantId} className="flex flex-col gap-2">
              <Link href={row.href} className="group flex flex-col gap-1 no-underline">
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-container">
                  {row.imageUrl ? (
                    <img src={row.imageUrl} alt={row.title} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                {row.brand ? (
                  <span className="font-mono text-label-caps uppercase text-muted">{row.brand}</span>
                ) : null}
                <span className="font-sans text-body-md font-medium text-ink">{row.title}</span>
                <Price value={row.price} />
              </Link>
              <div className="flex items-center gap-3">
                <form action={moveWishlistItemToBagAction}>
                  <input type="hidden" name="variant_id" value={row.variantId} />
                  <button
                    type="submit"
                    className="font-mono text-label-caps uppercase text-ink underline-offset-4 hover:underline"
                  >
                    Move to bag
                  </button>
                </form>
                <form action={removeWishlistAction}>
                  <input type="hidden" name="variant_id" value={row.variantId} />
                  <button
                    type="submit"
                    className="font-mono text-label-caps uppercase text-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
