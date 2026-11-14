"use client";

import { useActionState } from "react";
import { Button, Input, Select } from "@thl/ui";
import type { ProductCategory } from "../../../../lib/api/categories";
import { createProductAction, type ProductFormState } from "../actions";

const EMPTY_STATE: ProductFormState = {};

export function NewProductForm({ categories }: { categories: ProductCategory[] }) {
  const [state, formAction, pending] = useActionState(createProductAction, EMPTY_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5 border border-line bg-surface p-6">
      <Input label="Title" name="title" required />
      <Input label="Description" name="description" />
      <Input label="Thumbnail URL" name="thumbnail" placeholder="https://…" />
      <Select label="Category" name="category_id" defaultValue="">
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input
        label="Sizes"
        name="sizes"
        placeholder="UK 7, UK 8, UK 9"
        hint="Comma-separated. One variant is created per size."
        required
      />
      <Input
        label="Price per variant (₹)"
        name="price_rupees"
        type="number"
        step="0.01"
        min="0"
        required
        hint="Applied to every size at creation; adjust individual variants afterwards."
      />
      {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
      <Button type="submit" loading={pending}>
        {pending ? "Creating" : "Create product"}
      </Button>
    </form>
  );
}
