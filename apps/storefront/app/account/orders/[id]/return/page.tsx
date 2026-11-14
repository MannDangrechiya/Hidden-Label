import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReturnForm } from "@/components/return-form";
import { getCurrentCustomer } from "@/lib/session";
import { fetchOrder } from "@/lib/medusa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request a return" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReturnRequestPage({ params }: PageProps) {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await fetchOrder(id);
  if (!order || order.customer_id !== session.customer.id) notFound();

  const items = (order.items ?? []).map((item) => ({
    id: item.id,
    title: item.product_title ?? item.title,
    quantity: item.quantity,
  }));

  return (
    <main className="mx-auto w-full max-w-md px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
      <nav aria-label="Breadcrumb" className="mb-md">
        <Link href={`/account/orders/${order.id}`} className="font-mono text-label-caps uppercase text-muted no-underline hover:text-ink">
          ← Back to order THL-{order.display_id}
        </Link>
      </nav>

      <h1 className="type-headline-lg mb-2 uppercase">Request a return</h1>
      <p className="mb-md font-sans text-body-sm text-on-surface-variant">
        Returns are accepted within 7 days of delivery for unworn items with original tags.
        Final-sale items are not eligible. Eligibility is re-checked by our team on review.
      </p>

      {items.length === 0 ? (
        <p className="font-sans text-body-sm text-muted">This order has no returnable items.</p>
      ) : (
        <ReturnForm orderId={order.id} items={items} />
      )}
    </main>
  );
}
