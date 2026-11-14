"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, EmptyState, Input, Modal, Select, StatusChip, Table } from "@thl/ui";
import type { ProductCategory } from "../../../lib/api/categories";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
  type CategoryFormState,
} from "./actions";

const EMPTY_STATE: CategoryFormState = {};

function CategoryFields({
  category,
  categories,
}: {
  category?: ProductCategory;
  categories: ProductCategory[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input label="Name" name="name" defaultValue={category?.name} required />
      <Input label="Handle" name="handle" defaultValue={category?.handle} placeholder="auto from name" />
      <Select label="Parent category" name="parent_category_id" defaultValue={category?.parent_category_id ?? ""}>
        <option value="">None (top level)</option>
        {categories
          .filter((c) => c.id !== category?.id)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
      <div className="sm:col-span-2">
        <Input label="Description" name="description" defaultValue={category?.description ?? ""} />
      </div>
      <label className="flex items-center gap-2 font-sans text-body-sm text-on-surface-variant">
        <input type="checkbox" name="is_active" defaultChecked={category?.is_active ?? true} />
        Active
      </label>
      <label className="flex items-center gap-2 font-sans text-body-sm text-on-surface-variant">
        <input type="checkbox" name="is_internal" defaultChecked={category?.is_internal ?? false} />
        Internal (hidden from storefront)
      </label>
    </div>
  );
}

export function CategoryManager({
  categories,
  canWrite,
}: {
  categories: ProductCategory[];
  canWrite: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [createState, createFormAction, createPending] = useActionState(createCategoryAction, EMPTY_STATE);
  const [updateState, updateFormAction, updatePending] = useActionState(updateCategoryAction, EMPTY_STATE);

  useEffect(() => {
    if (createState.success) setCreating(false);
  }, [createState]);
  useEffect(() => {
    if (updateState.success) setEditing(null);
  }, [updateState]);

  const parentName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-body-sm text-on-surface-variant">{categories.length} categories</p>
        {canWrite ? <Button onClick={() => setCreating(true)}>New category</Button> : null}
      </div>

      {categories.length === 0 ? (
        <EmptyState title="No categories yet" description="Create the first category to build the taxonomy tree." />
      ) : (
        <Table
          columns={[
            { key: "name", header: "Category", render: (c) => c.name, sticky: true },
            { key: "handle", header: "Handle", render: (c) => c.handle },
            { key: "parent", header: "Parent", render: (c) => parentName(c.parent_category_id) },
            {
              key: "status",
              header: "Status",
              render: (c) => (
                <StatusChip tone={c.is_active ? "positive" : "neutral"}>
                  {c.is_active ? "Active" : "Inactive"}
                </StatusChip>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (c) =>
                canWrite ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="font-mono text-label-caps uppercase text-ink underline"
                      onClick={() => setEditing(c)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="font-mono text-label-caps uppercase text-error underline"
                      onClick={() => {
                        if (confirm(`Delete ${c.name}?`)) void deleteCategoryAction(c.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null,
            },
          ]}
          rows={categories}
          rowKey={(c) => c.id}
        />
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New category">
        <form action={createFormAction} className="flex flex-col gap-4">
          <CategoryFields categories={categories} />
          {createState.error ? <p className="font-sans text-body-sm text-error">{createState.error}</p> : null}
          <Button type="submit" loading={createPending}>
            Create category
          </Button>
        </form>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`}>
        {editing ? (
          <form action={updateFormAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={editing.id} />
            <CategoryFields category={editing} categories={categories} />
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
