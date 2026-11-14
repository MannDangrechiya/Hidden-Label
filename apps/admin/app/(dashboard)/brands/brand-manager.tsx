"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, EmptyState, Input, Modal, StatusChip, Table } from "@thl/ui";
import type { Brand } from "../../../lib/api/brands";
import { createBrandAction, deleteBrandAction, updateBrandAction, type BrandFormState } from "./actions";

const EMPTY_STATE: BrandFormState = {};

function BrandFields({ brand }: { brand?: Brand }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input label="Handle" name="handle" defaultValue={brand?.handle} required disabled={Boolean(brand)} />
      <Input label="Name" name="name" defaultValue={brand?.name} required />
      <Input label="Tagline" name="tagline" defaultValue={brand?.tagline ?? ""} />
      <Input label="Country" name="country" defaultValue={brand?.country ?? ""} />
      <Input
        label="Partnership tier"
        name="partnership_tier"
        defaultValue={brand?.partnership_tier ?? ""}
      />
      <Input
        label="Sort order"
        name="sort_order"
        type="number"
        defaultValue={brand?.sort_order ?? 0}
      />
      <Input label="Logo URL" name="logo_url" defaultValue={brand?.logo_url ?? ""} />
      <Input label="Hero URL" name="hero_url" defaultValue={brand?.hero_url ?? ""} />
      <div className="sm:col-span-2">
        <Input label="Description" name="description" defaultValue={brand?.description ?? ""} />
      </div>
      <label className="flex items-center gap-2 font-sans text-body-sm text-on-surface-variant">
        <input type="checkbox" name="is_active" defaultChecked={brand?.is_active ?? true} />
        Active (visible on the storefront)
      </label>
    </div>
  );
}

export function BrandManager({ brands, canWrite }: { brands: Brand[]; canWrite: boolean }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [createState, createFormAction, createPending] = useActionState(createBrandAction, EMPTY_STATE);
  const [updateState, updateFormAction, updatePending] = useActionState(updateBrandAction, EMPTY_STATE);

  useEffect(() => {
    if (createState.success) setCreating(false);
  }, [createState]);

  useEffect(() => {
    if (updateState.success) setEditing(null);
  }, [updateState]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-body-sm text-on-surface-variant">{brands.length} brands</p>
        {canWrite ? (
          <Button onClick={() => setCreating(true)}>New brand</Button>
        ) : (
          <StatusChip tone="neutral">Read-only</StatusChip>
        )}
      </div>

      {brands.length === 0 ? (
        <EmptyState
          title="No brands yet"
          description={
            canWrite ? "Create the first brand to start grouping products." : "No brands have been created."
          }
        />
      ) : (
      <Table
        columns={[
          { key: "name", header: "Brand", render: (b) => b.name, sticky: true },
          { key: "handle", header: "Handle", render: (b) => b.handle },
          { key: "tier", header: "Tier", render: (b) => b.partnership_tier ?? "—" },
          { key: "products", header: "Products", render: (b) => b.product_count, align: "right" },
          {
            key: "status",
            header: "Status",
            render: (b) => (
              <StatusChip tone={b.is_active ? "positive" : "neutral"}>
                {b.is_active ? "Active" : "Inactive"}
              </StatusChip>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (b) =>
              canWrite ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="font-mono text-label-caps uppercase text-ink underline"
                    onClick={() => setEditing(b)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="font-mono text-label-caps uppercase text-error underline"
                    onClick={() => {
                      if (confirm(`Remove ${b.name}? Brands with products are deactivated instead.`)) {
                        void deleteBrandAction(b.id);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null,
          },
        ]}
        rows={brands}
        rowKey={(b) => b.id}
      />
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New brand">
        <form action={createFormAction} className="flex flex-col gap-4">
          <BrandFields />
          {createState.error ? <p className="font-sans text-body-sm text-error">{createState.error}</p> : null}
          <Button type="submit" loading={createPending}>
            Create brand
          </Button>
        </form>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`}>
        {editing ? (
          <form action={updateFormAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={editing.id} />
            <BrandFields brand={editing} />
            {updateState.error ? (
              <p className="font-sans text-body-sm text-error">{updateState.error}</p>
            ) : null}
            <Button type="submit" loading={updatePending}>
              Save changes
            </Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
