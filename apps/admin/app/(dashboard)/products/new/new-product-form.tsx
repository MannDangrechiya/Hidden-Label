"use client";

import { useActionState } from "react";
import { Button, Input, Select } from "@thl/ui";
import type { ProductCategory } from "../../../../lib/api/categories";
import { createProductAction, type ProductFormState } from "../actions";

const EMPTY_STATE: ProductFormState = {};

const COUNTRIES = [
  "India",
  "Italy",
  "Portugal",
  "France",
  "United Kingdom",
  "Japan",
  "United States",
  "Germany",
  "Spain",
  "Vietnam",
  "China",
  "Turkey",
];

export function NewProductForm({ categories }: { categories: ProductCategory[] }) {
  const [state, formAction, pending] = useActionState(createProductAction, EMPTY_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5 border border-line bg-surface p-6">
      <Input label="Title" name="title" required />
      <Input label="Brand" name="brand" placeholder="e.g. The Hidden Label, Rick Owens, etc." />
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Country of Origin (Legal Metrology)"
          name="country_of_origin"
          defaultValue=""
          required
        >
          <option value="">Select country of origin...</option>
          {COUNTRIES.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </Select>
        <Input label="HSN Code" name="hsn" placeholder="e.g. 6109, 6203, 6403" />
      </div>
      <Select label="Gender / Demographic" name="gender" defaultValue="">
        <option value="">Unspecified</option>
        <option value="unisex">Unisex</option>
        <option value="men">Men</option>
        <option value="women">Women</option>
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
