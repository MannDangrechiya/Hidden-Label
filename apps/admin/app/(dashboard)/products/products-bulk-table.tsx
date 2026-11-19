"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, StatusChip, Table } from "@thl/ui";
import type { AdminProduct, ProductStatus } from "../../../lib/api/products";
import { bulkDeleteProductsAction, bulkSetProductStatusAction } from "./actions";

const STATUS_TONE: Record<ProductStatus, "neutral" | "positive" | "warning" | "critical"> = {
  draft: "neutral",
  proposed: "warning",
  published: "positive",
  rejected: "critical",
};

function stockOf(product: AdminProduct): number {
  return (product.variants ?? []).reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0);
}

/** MF-26: select several products and publish/draft/delete them in one action. */
export function ProductsBulkTable({ products, canWrite }: { products: AdminProduct[]; canWrite: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = products.length > 0 && selected.size === products.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleAll}
            className="font-mono text-label-caps uppercase text-ink underline-offset-4 hover:underline"
          >
            {allSelected ? "Clear selection" : "Select all"}
          </button>
          {selected.size > 0 ? (
            <span className="font-mono text-label-caps uppercase text-muted">
              {selected.size} selected
            </span>
          ) : null}
        </div>
      ) : null}

      {canWrite && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border border-ink bg-surface-low px-4 py-3">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => runBulk(() => bulkSetProductStatusAction([...selected], "published"))}
          >
            Publish
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => runBulk(() => bulkSetProductStatusAction([...selected], "draft"))}
          >
            Move to draft
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Delete ${selected.size} product(s)? This cannot be undone.`)) return;
              runBulk(() => bulkDeleteProductsAction([...selected]));
            }}
          >
            Delete
          </Button>
        </div>
      ) : null}

      <Table
        columns={[
          {
            key: "select",
            header: "",
            render: (p) =>
              canWrite ? (
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggleOne(p.id)}
                  aria-label={`Select ${p.title}`}
                />
              ) : null,
          },
          {
            key: "title",
            header: "Product",
            sticky: true,
            render: (p) => (
              <Link href={`/products/${p.id}`} className="text-ink underline">
                {p.title}
              </Link>
            ),
          },
          { key: "handle", header: "Handle", render: (p) => p.handle },
          {
            key: "status",
            header: "Status",
            render: (p) => <StatusChip tone={STATUS_TONE[p.status]}>{p.status}</StatusChip>,
          },
          { key: "variants", header: "Variants", render: (p) => p.variants?.length ?? 0, align: "right" },
          { key: "stock", header: "Stock", render: (p) => stockOf(p), align: "right" },
          {
            key: "categories",
            header: "Categories",
            render: (p) => p.categories?.map((c) => c.name).join(", ") || "—",
          },
        ]}
        rows={products}
        rowKey={(p) => p.id}
      />
    </div>
  );
}
