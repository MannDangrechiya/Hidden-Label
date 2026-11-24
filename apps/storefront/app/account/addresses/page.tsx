import { EmptyState, ErrorState } from "@thl/ui";
import { redirect } from "next/navigation";
import { createAddressAction, deleteAddressAction } from "@/app/actions/account";
import { AddressForm } from "@/components/address-form";
import { getCurrentCustomer } from "@/lib/session";
import { listAddresses, MedusaError } from "@/lib/medusa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Address book" };

export default async function AddressesPage() {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  let addresses: Awaited<ReturnType<typeof listAddresses>> = [];
  let error: string | null = null;
  try {
    addresses = await listAddresses(session.token);
  } catch (caught) {
    error = caught instanceof MedusaError ? caught.message : "Could not load your addresses.";
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-col gap-2 border-b border-line pb-sp-3">
        <p className="font-mono text-label-caps uppercase text-muted">Delivery addresses</p>
        <h1 className="type-headline-lg uppercase">Address book</h1>
      </header>

      <div className="grid grid-cols-1 gap-sp-5 lg:grid-cols-[1fr_360px]">
        <section>
          {error ? (
            <ErrorState message={error} />
          ) : addresses.length === 0 ? (
            <EmptyState title="No saved addresses" description="Add one so checkout goes faster next time." />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0 border border-line p-0">
              {addresses.map((address) => (
                <li key={address.id} className="flex items-start justify-between gap-4 border-b border-line p-sp-3 last:border-b-0">
                  <address className="not-italic font-sans text-body-sm text-on-surface-variant">
                    <span className="font-sans text-body-md text-ink">
                      {address.first_name} {address.last_name}
                    </span>
                    <br />
                    {address.address_1}
                    {address.address_2 ? `, ${address.address_2}` : ""}
                    <br />
                    {address.city}, {address.province} {address.postal_code}
                    <br />
                    {address.phone}
                    {address.is_default_shipping ? (
                      <>
                        <br />
                        <span className="font-mono text-label-caps uppercase text-muted">Default</span>
                      </>
                    ) : null}
                  </address>
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="address_id" value={address.id} />
                    <button
                      type="submit"
                      className="font-mono text-label-caps uppercase text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      Delete
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="h-fit border border-line p-sp-3">
          <h2 className="mb-sp-3 font-mono text-label-caps uppercase text-muted">Add an address</h2>
          <AddressForm action={createAddressAction} submitLabel="Save address" />
        </aside>
      </div>
    </main>
  );
}
