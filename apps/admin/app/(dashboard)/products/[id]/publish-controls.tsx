"use client";

import { useTransition } from "react";
import { Button } from "@thl/ui";
import type { ProductStatus } from "../../../../lib/api/products";
import { setProductStatusAction } from "../actions";

export function PublishControls({ productId, status }: { productId: string; status: ProductStatus }) {
  const [pending, startTransition] = useTransition();

  const setStatus = (next: ProductStatus) => startTransition(() => setProductStatusAction(productId, next));

  return status === "published" ? (
    <Button variant="secondary" loading={pending} onClick={() => setStatus("draft")}>
      Unpublish
    </Button>
  ) : (
    <Button loading={pending} onClick={() => setStatus("published")}>
      Publish
    </Button>
  );
}
