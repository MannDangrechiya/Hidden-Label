import { ErrorState } from "@thl/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { updateProfileAction } from "@/app/actions/account";
import { ProfileForm } from "@/components/profile-form";
import { getCurrentCustomer } from "@/lib/session";
import { listMyOrders, MedusaError } from "@/lib/medusa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  let recentOrders: Awaited<ReturnType<typeof listMyOrders>>["orders"] = [];
  let ordersError: string | null = null;
  try {
    const data = await listMyOrders(session.token, { limit: 3 });
    recentOrders = data.orders;
  } catch (caught) {
    ordersError = caught instanceof MedusaError ? caught.message : "Could not load recent orders.";
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-lg flex flex-wrap items-center justify-between gap-4 border-b border-line pb-md">
        <div>
          <p className="font-mono text-label-caps uppercase text-muted">Customer dashboard</p>
          <h1 className="type-headline-lg mt-2 uppercase">
            Welcome, {session.customer.first_name ?? session.customer.email}
          </h1>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="font-mono text-label-caps uppercase text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="grid gap-xl lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-md">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="font-display text-headline-sm uppercase">Recent orders</h2>
            <Link href="/account/orders" className="font-mono text-label-caps uppercase text-muted hover:text-ink">
              View all
            </Link>
          </div>

          {ordersError ? (
            <ErrorState message={ordersError} />
          ) : recentOrders.length === 0 ? (
            <p className="font-sans text-body-sm text-on-surface-variant">
              No orders yet.{" "}
              <Link href="/collections/all" className="underline">
                Start shopping
              </Link>
              .
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0 border border-line p-0">
              {recentOrders.map((order) => (
                <li key={order.id} className="border-b border-line p-md last:border-b-0">
                  <Link href={`/account/orders/${order.id}`} className="flex items-center justify-between no-underline">
                    <div className="flex flex-col">
                      <span className="font-mono text-label-caps uppercase text-ink">
                        THL-{order.display_id}
                      </span>
                      <span className="font-sans text-body-sm text-muted">{order.status}</span>
                    </div>
                    <span className="font-mono text-currency-md tabular text-ink">
                      ₹{order.total.toLocaleString("en-IN")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <nav aria-label="Account" className="mt-md flex flex-wrap gap-3">
            <Link
              href="/account/orders"
              className="border border-ink px-4 py-2 font-mono text-label-caps uppercase text-ink no-underline hover:bg-ink hover:text-white"
            >
              Orders
            </Link>
            <Link
              href="/account/bids"
              className="border border-ink px-4 py-2 font-mono text-label-caps uppercase text-ink no-underline hover:bg-ink hover:text-white"
            >
              My Bids
            </Link>
            <Link
              href="/account/asks"
              className="border border-ink px-4 py-2 font-mono text-label-caps uppercase text-ink no-underline hover:bg-ink hover:text-white"
            >
              Consignments
            </Link>
            <Link
              href="/account/wishlist"
              className="border border-ink px-4 py-2 font-mono text-label-caps uppercase text-ink no-underline hover:bg-ink hover:text-white"
            >
              Wishlist
            </Link>
            <Link
              href="/fit-studio"
              className="border border-ink px-4 py-2 font-mono text-label-caps uppercase text-ink no-underline hover:bg-ink hover:text-white"
            >
              Fit Studio
            </Link>
            <Link
              href="/account/addresses"
              className="border border-ink px-4 py-2 font-mono text-label-caps uppercase text-ink no-underline hover:bg-ink hover:text-white"
            >
              Addresses
            </Link>
          </nav>
        </section>

        <aside className="h-fit border border-line p-md">
          <h2 className="mb-md font-mono text-label-caps uppercase text-muted">Profile</h2>
          <ProfileForm
            action={updateProfileAction}
            defaultValues={{
              first_name: session.customer.first_name ?? "",
              last_name: session.customer.last_name ?? "",
              phone: session.customer.phone ?? "",
            }}
          />
          <p className="mt-md font-sans text-body-sm text-muted">Email: {session.customer.email}</p>
        </aside>
      </div>
    </main>
  );
}
