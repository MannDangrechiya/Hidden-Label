"use client";

import { useActionState } from "react";
import { Button, Input } from "@thl/ui";
import type { AdminProduct } from "../../../../lib/api/products";
import { updateProductAction, type ProductFormState } from "../actions";

const EMPTY_STATE: ProductFormState = {};

export function EditProductForm({ product, canWrite }: { product: AdminProduct; canWrite: boolean }) {
  const [state, formAction, pending] = useActionState(updateProductAction, EMPTY_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4 border border-line bg-surface p-5">
      <input type="hidden" name="id" value={product.id} />
      <Input label="Title" name="title" defaultValue={product.title} disabled={!canWrite} required />
      <Input label="Description" name="description" defaultValue={product.description ?? ""} disabled={!canWrite} />
      <Input label="Thumbnail URL" name="thumbnail" defaultValue={product.thumbnail ?? ""} disabled={!canWrite} />
      {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
      {canWrite ? (
        <Button type="submit" loading={pending} className="self-start">
          Save changes
        </Button>
      ) : null}
    </form>
  );
}
