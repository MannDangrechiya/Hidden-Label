"use client";

import { useActionState, useRef, useTransition } from "react";
import { Button } from "@thl/ui";
import type { AdminProduct } from "../../../../lib/api/products";
import { addProductImageAction, removeProductImageAction, type ImageFormState } from "../actions";

const EMPTY_STATE: ImageFormState = {};

export function MediaManager({ product, canWrite }: { product: AdminProduct; canWrite: boolean }) {
  const [state, formAction, pending] = useActionState(addProductImageAction, EMPTY_STATE);
  const [removing, startRemove] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-4">
      {product.thumbnail ? (
        <img src={product.thumbnail} alt="" className="aspect-square w-40 border border-line object-cover" />
      ) : (
        <p className="font-sans text-body-sm text-muted">No thumbnail set.</p>
      )}

      {product.images && product.images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {product.images.map((img) => (
            <div key={img.id} className="relative">
              <img src={img.url} alt="" className="h-20 w-20 border border-line object-cover" />
              {canWrite ? (
                <button
                  type="button"
                  disabled={removing}
                  onClick={() => startRemove(() => removeProductImageAction(product.id, img.url))}
                  aria-label="Remove image"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center bg-ink font-mono text-[10px] text-white disabled:opacity-50"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {canWrite ? (
        <form
          ref={formRef}
          action={(formData) => {
            formAction(formData);
            formRef.current?.reset();
          }}
          className="flex flex-col gap-2 border-t border-line pt-4"
        >
          <input type="hidden" name="product_id" value={product.id} />
          <input
            type="file"
            name="file"
            accept="image/*"
            required
            className="font-sans text-body-sm"
          />
          {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
          <Button type="submit" variant="secondary" loading={pending} className="self-start">
            Upload image
          </Button>
        </form>
      ) : null}
    </div>
  );
}
