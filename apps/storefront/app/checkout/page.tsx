import { moneyFromRupees } from "@thl/shared";
import { Price } from "@thl/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutAddressForm } from "@/components/checkout-address-form";
import { CheckoutShippingForm } from "@/components/checkout-shipping-form";
import { CheckoutPaymentForm } from "@/components/checkout-payment-form";
import { readCartId } from "@/lib/cart-cookie";
import { isFulfilmentMode, PICKUP_LOCATION, type FulfilmentMode } from "@/lib/fulfilment";
import {
  fetchCart,
  listRegionPaymentProviders,
  listShippingOptions,
  resolveRegionId,
  type ShippingOption,
} from "@/lib/medusa";
import { getCurrentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

interface PageProps {
  searchParams: Promise<{ step?: string }>;
}

function lineTotal(item: { total?: number; unit_price: number; quantity: number }): number {
  return typeof item.total === "number" ? item.total : item.unit_price * item.quantity;
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const cartId = await readCartId();
  if (!cartId) redirect("/cart");

  const cart = await fetchCart(cartId);
  if (!cart || cart.items.length === 0) redirect("/cart");

  const session = await getCurrentCustomer().catch(() => null);
  const { step: stepParam } = await searchParams;
  const hasAddress = Boolean(cart.shipping_address?.address_1);
  const hasShipping = Boolean(cart.shipping_methods && cart.shipping_methods.length > 0);
  const step = stepParam ?? (hasAddress ? (hasShipping ? "payment" : "shipping") : "address");
  const fulfilmentMode: FulfilmentMode = isFulfilmentMode(cart.metadata?.["fulfilment_mode"])
    ? cart.metadata["fulfilment_mode"]
    : "home_delivery";

  let shippingOptions: ShippingOption[] = [];
  let paymentProviderIds: string[] = [];
  if (step === "shipping") {
    try {
      shippingOptions = await listShippingOptions(cartId);
    } catch {
      shippingOptions = [];
    }
  }
  if (step === "payment") {
    const regionId = await resolveRegionId();
    if (regionId) {
      try {
        const providers = await listRegionPaymentProviders(regionId);
        paymentProviderIds = providers.map((provider) => provider.id);
      } catch {
        paymentProviderIds = ["pp_system_default"];
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-col gap-2 border-b border-line pb-sp-3">
        <p className="font-mono text-label-caps uppercase text-muted">Payment &amp; settlement</p>
        <h1 className="type-headline-lg uppercase">Checkout</h1>
        <nav aria-label="Checkout steps" className="flex gap-3 font-mono text-label-caps uppercase">
          <span className={step === "address" ? "text-ink" : "text-muted"}>1. Address</span>
          <span aria-hidden="true">/</span>
          <span className={step === "shipping" ? "text-ink" : "text-muted"}>2. Shipping</span>
          <span aria-hidden="true">/</span>
          <span className={step === "payment" ? "text-ink" : "text-muted"}>3. Payment</span>
        </nav>
      </header>

      <div className="grid gap-sp-5 lg:grid-cols-[1fr_360px]">
        <section>
          {step === "address" ? (
            <CheckoutAddressForm
              defaultEmail={session?.customer.email ?? cart.email ?? ""}
              defaultValues={cart.shipping_address ?? undefined}
            />
          ) : step === "shipping" ? (
            <CheckoutShippingForm
              options={shippingOptions}
              selectedId={cart.shipping_methods?.[0]?.shipping_option_id}
              initialMode={fulfilmentMode}
            />
          ) : (
            <CheckoutPaymentForm
              availableProviderIds={paymentProviderIds}
              email={session?.customer.email ?? cart.email ?? ""}
              phone={cart.shipping_address?.phone ?? ""}
              totalRupees={cart.total ?? 0}
              fulfilmentMode={fulfilmentMode}
            />
          )}

          {step !== "address" ? (
            <Link
              href="/checkout?step=address"
              className="mt-sp-3 inline-block font-mono text-label-caps uppercase text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Edit delivery address
            </Link>
          ) : null}
        </section>

        <aside className="h-fit border border-line p-sp-3">
          <h2 className="mb-sp-3 font-mono text-label-caps uppercase text-muted">Order review</h2>
          <ul className="m-0 mb-sp-3 flex list-none flex-col gap-3 divide-y divide-line p-0">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 pt-3 first:pt-0">
                <span className="font-sans text-body-sm text-ink">
                  {item.product_title ?? item.title} × {item.quantity}
                </span>
                <Price value={moneyFromRupees(lineTotal(item))} />
              </li>
            ))}
          </ul>
          <dl className="m-0 flex flex-col gap-2 border-t border-line pt-3 font-sans text-body-sm">
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Item subtotal</dt>
              <dd className="m-0">
                <Price value={moneyFromRupees(cart.item_total ?? 0)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">
                {fulfilmentMode === "store_pickup" ? "Collection (boutique)" : "Shipping"}
              </dt>
              <dd className="m-0">
                <Price value={moneyFromRupees(cart.shipping_total ?? 0)} />
              </dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-line pt-3">
              <dt className="font-mono text-label-caps uppercase text-ink">Total</dt>
              <dd className="m-0">
                <Price value={moneyFromRupees(cart.total ?? 0)} size="lg" />
              </dd>
            </div>
          </dl>
          {fulfilmentMode === "store_pickup" ? (
            <div className="mt-sp-3 border border-ink p-3">
              <p className="font-mono text-label-caps uppercase text-ink">Collect in boutique</p>
              <p className="mt-1 font-sans text-body-sm text-on-surface-variant">{PICKUP_LOCATION.address}</p>
              <p className="mt-1 font-mono text-label-caps uppercase text-muted">
                {PICKUP_LOCATION.hours}
              </p>
            </div>
          ) : null}

          <p className="mt-sp-3 font-sans text-body-sm text-muted">
            All prices in INR, inclusive of duties and GST.
          </p>
        </aside>
      </div>
    </main>
  );
}
