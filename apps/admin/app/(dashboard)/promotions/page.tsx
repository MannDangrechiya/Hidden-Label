import type { Metadata } from "next";
import Link from "next/link";
import { Button, EmptyState, ErrorState, StatusChip, Table } from "@thl/ui";
import { fetchPromotions } from "../../../lib/api/promotions";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Promotions" };

/** A-13 — Coupons & Promotions. */
export default async function PromotionsPage() {
  let result;
  try {
    result = await fetchPromotions({ limit: 100 });
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load promotions.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-headline-lg">Promotions</h1>
        <Link href="/promotions/new">
          <Button>New promotion</Button>
        </Link>
      </div>

      {result.promotions.length === 0 ? (
        <EmptyState
          title="No promotions yet"
          description="Create a code to offer a discount at checkout."
          action={
            <Link href="/promotions/new">
              <Button variant="secondary">New promotion</Button>
            </Link>
          }
        />
      ) : (
        <Table
          columns={[
            {
              key: "code",
              header: "Code",
              sticky: true,
              render: (p) => (
                <Link href={`/promotions/${p.id}`} className="text-ink underline">
                  {p.code ?? "(automatic)"}
                </Link>
              ),
            },
            {
              key: "value",
              header: "Discount",
              render: (p) =>
                p.application_method
                  ? p.application_method.type === "percentage"
                    ? `${p.application_method.value}%`
                    : `₹${p.application_method.value}`
                  : "—",
            },
            { key: "status", header: "Status", render: (p) => <StatusChip tone={p.status === "active" ? "positive" : "neutral"}>{p.status}</StatusChip> },
            { key: "automatic", header: "Automatic", render: (p) => (p.is_automatic ? "Yes" : "No") },
            { key: "limit", header: "Usage limit", render: (p) => p.usage_limit ?? "Unlimited", align: "right" },
          ]}
          rows={result.promotions}
          rowKey={(p) => p.id}
        />
      )}
    </div>
  );
}
