"use client";

import { useActionState } from "react";
import { Button, Input, Select } from "@thl/ui";
import type { AdminProduct } from "../../../../lib/api/products";
import { updateProductAction, type ProductFormState } from "../actions";

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

export function EditProductForm({ product, canWrite }: { product: AdminProduct; canWrite: boolean }) {
  const [state, formAction, pending] = useActionState(updateProductAction, EMPTY_STATE);

  const metadata = (product.metadata ?? {}) as Record<string, unknown>;
  const brand = typeof metadata.brand === "string" ? metadata.brand : "";
  const countryOfOrigin = typeof metadata.country_of_origin === "string" ? metadata.country_of_origin : "";
  const hsn = typeof metadata.hsn === "string" ? metadata.hsn : "";
  const gender = typeof metadata.gender === "string" ? metadata.gender : "";

  return (
    <form action={formAction} className="flex flex-col gap-4 border border-line bg-surface p-5">
      <input type="hidden" name="id" value={product.id} />
      <Input label="Title" name="title" defaultValue={product.title} disabled={!canWrite} required />
      <Input
        label="Brand"
        name="brand"
        defaultValue={brand}
        disabled={!canWrite}
        placeholder="e.g. The Hidden Label, Rick Owens"
      />
      <Input
        label="Description"
        name="description"
        defaultValue={product.description ?? ""}
        disabled={!canWrite}
      />
      <Input
        label="Thumbnail URL"
        name="thumbnail"
        defaultValue={product.thumbnail ?? ""}
        disabled={!canWrite}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Country of Origin (Legal Metrology)"
          name="country_of_origin"
          defaultValue={countryOfOrigin}
          disabled={!canWrite}
        >
          <option value="">Select country of origin...</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          label="HSN Code"
          name="hsn"
          defaultValue={hsn}
          disabled={!canWrite}
          placeholder="e.g. 6109, 6203, 6403"
        />
      </div>

      <Select label="Gender / Demographic" name="gender" defaultValue={gender} disabled={!canWrite}>
        <option value="">Unspecified</option>
        <option value="unisex">Unisex</option>
        <option value="men">Men</option>
        <option value="women">Women</option>
      </Select>

      {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
      {canWrite ? (
        <Button type="submit" loading={pending} className="self-start">
          Save changes
        </Button>
      ) : null}
    </form>
  );
}
