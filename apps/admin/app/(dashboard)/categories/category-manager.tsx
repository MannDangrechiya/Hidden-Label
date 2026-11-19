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

/** Depth-first, parents-before-children ordering so the flat Table reads as a tree. */
function treeOrder(categories: ProductCategory[]): { category: ProductCategory; depth: number }[] {
  const byParent = new Map<string, ProductCategory[]>();
  for (const category of categories) {
    const key = category.parent_category_id ?? "";
    const siblings = byParent.get(key) ?? [];
    siblings.push(category);
    byParent.set(key, siblings);
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

  const ordered: { category: ProductCategory; depth: number }[] = [];
  function visit(parentId: string, depth: number) {
    for (const category of byParent.get(parentId) ?? []) {
      ordered.push({ category, depth });
      visit(category.id, depth + 1);
    }
  }
  visit("", 0);
  return ordered;
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

  const ordered = treeOrder(categories);

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
            {
              key: "name",
              header: "Category",
              sticky: true,
              render: ({ category, depth }) => (
                <span style={{ paddingLeft: depth * 20 }} className="inline-block">
                  {depth > 0 ? <span className="mr-1.5 text-on-surface-variant">└</span> : null}
                  {category.name}
                </span>
              ),
            },
            { key: "handle", header: "Handle", render: ({ category }) => category.handle },
            {
              key: "status",
              header: "Status",
              render: ({ category }) => (
                <StatusChip tone={category.is_active ? "positive" : "neutral"}>
                  {category.is_active ? "Active" : "Inactive"}
                </StatusChip>
              ),
            },
            {
              key: "actions",
              header: "",
              render: ({ category }) =>
                canWrite ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="font-mono text-label-caps uppercase text-ink underline"
                      onClick={() => setEditing(category)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="font-mono text-label-caps uppercase text-error underline"
                      onClick={() => {
                        if (confirm(`Delete ${category.name}?`)) void deleteCategoryAction(category.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null,
            },
          ]}
          rows={ordered}
          rowKey={({ category }) => category.id}
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
