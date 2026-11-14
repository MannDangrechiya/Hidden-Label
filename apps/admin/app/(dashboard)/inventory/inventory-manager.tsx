"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, EmptyState, Input, Modal, Select, StatusChip, Table } from "@thl/ui";
import type { InventoryLevel, StockLocation } from "../../../lib/api/inventory";
import { ADJUST_REASONS } from "../../../lib/constants";
import { adjustInventoryAction, type AdjustFormState } from "./actions";

const EMPTY_STATE: AdjustFormState = {};

export function InventoryManager({
  levels,
  locations,
  canWrite,
  lowOnly,
}: {
  levels: InventoryLevel[];
  locations: StockLocation[];
  canWrite: boolean;
  lowOnly: boolean;
}) {
  const [adjusting, setAdjusting] = useState<InventoryLevel | null>(null);
  const [state, formAction, pending] = useActionState(adjustInventoryAction, EMPTY_STATE);

  useEffect(() => {
    if (state.success) setAdjusting(null);
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-body-sm text-on-surface-variant">{levels.length} stock levels</p>
        <div className="flex gap-3">
          <a
            href="/inventory"
            className={`font-mono text-label-caps uppercase ${!lowOnly ? "text-ink underline" : "text-muted"}`}
          >
            All
          </a>
          <a
            href="/inventory?low=true"
            className={`font-mono text-label-caps uppercase ${lowOnly ? "text-ink underline" : "text-muted"}`}
          >
            Low stock only
          </a>
        </div>
      </div>

      {levels.length === 0 ? (
        <EmptyState title="Nothing to show" description="No inventory levels match this filter." />
      ) : (
        <Table
          columns={[
            { key: "product", header: "Product", render: (l) => l.product_title ?? l.item_title ?? "—", sticky: true },
            { key: "variant", header: "Variant", render: (l) => l.variant_title ?? "—" },
            { key: "sku", header: "SKU", render: (l) => l.sku ?? "—" },
            { key: "stocked", header: "On hand", render: (l) => l.stocked_quantity, align: "right" },
            { key: "reserved", header: "Reserved", render: (l) => l.reserved_quantity, align: "right" },
            {
              key: "available",
              header: "Available",
              align: "right",
              render: (l) => (
                <StatusChip tone={l.available <= 3 ? (l.available <= 0 ? "critical" : "warning") : "neutral"}>
                  {l.available}
                </StatusChip>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (l) =>
                canWrite ? (
                  <button
                    type="button"
                    className="font-mono text-label-caps uppercase text-ink underline"
                    onClick={() => setAdjusting(l)}
                  >
                    Adjust
                  </button>
                ) : null,
            },
          ]}
          rows={levels}
          rowKey={(l) => l.id}
        />
      )}

      <Modal
        open={adjusting !== null}
        onClose={() => setAdjusting(null)}
        title={`Adjust stock — ${adjusting?.product_title ?? adjusting?.item_title ?? ""}`}
      >
        {adjusting ? (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="inventory_item_id" value={adjusting.inventory_item_id} />
            <Select label="Location" name="location_id" defaultValue={adjusting.location_id} required>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
            <Input
              label="Delta (use a negative number to remove stock)"
              name="delta"
              type="number"
              required
            />
            <Select label="Reason" name="reason" required defaultValue="">
              <option value="" disabled>
                Select a reason
              </option>
              {ADJUST_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
            <p className="font-sans text-body-sm text-muted">
              Currently {adjusting.stocked_quantity} on hand, {adjusting.reserved_quantity} reserved.
            </p>
            {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
            <Button type="submit" loading={pending}>
              Apply adjustment
            </Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
