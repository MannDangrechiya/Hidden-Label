"use client";

import { useActionState } from "react";
import { Button, Input, Table } from "@thl/ui";
import { formatINR, moneyFromRupees } from "@thl/shared";
import type { AdminVariant } from "../../../../lib/api/products";
import { updateVariantPriceAction, type VariantPriceFormState } from "../actions";

const EMPTY_STATE: VariantPriceFormState = {};

function VariantPriceForm({ productId, variant }: { productId: string; variant: AdminVariant }) {
  const [state, formAction, pending] = useActionState(updateVariantPriceAction, EMPTY_STATE);
  const price = variant.prices?.find((p) => p.currency_code === "inr");

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="variant_id" value={variant.id} />
      <input type="hidden" name="price_id" value={price?.id ?? ""} />
      <Input
        label=""
        aria-label="Price in rupees"
        name="price_rupees"
        type="number"
        step="0.01"
        min="0"
        defaultValue={price ? price.amount : ""}
        className="w-28"
      />
      <Button type="submit" variant="secondary" loading={pending}>
        Save
      </Button>
      {state.error ? <span className="font-sans text-body-sm text-error">{state.error}</span> : null}
    </form>
  );
}

export function VariantsTable({
  productId,
  variants,
  canWrite,
  stockByVariant,
}: {
  productId: string;
  variants: AdminVariant[];
  canWrite: boolean;
  /** Aggregated available stock per variant, built by the page from /admin/inventory levels. */
  stockByVariant: Map<string, number>;
}) {
  if (variants.length === 0) {
    return <p className="font-sans text-body-sm text-muted">This product has no variants yet.</p>;
  }

  return (
    <Table
      columns={[
        { key: "title", header: "Variant", render: (v) => v.title, sticky: true },
        { key: "sku", header: "SKU", render: (v) => v.sku ?? "—" },
        { key: "stock", header: "Stock", render: (v) => stockByVariant.get(v.id) ?? 0, align: "right" },
        {
          key: "price",
          header: "Price (₹)",
          render: (v) => {
            const price = v.prices?.find((p) => p.currency_code === "inr");
            if (!canWrite) return price ? formatINR(moneyFromRupees(price.amount)) : "—";
            return <VariantPriceForm productId={productId} variant={v} />;
          },
        },
      ]}
      rows={variants}
      rowKey={(v) => v.id}
    />
  );
}
