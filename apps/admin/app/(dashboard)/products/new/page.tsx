import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchCategories } from "../../../../lib/api/categories";
import { BackendError } from "../../../../lib/backend";
import { NewProductForm } from "./new-product-form";

export const metadata: Metadata = { title: "Add product" };

/** A-03 — Add Product Flow. */
export default async function NewProductPage() {
  let categories;
  try {
    categories = await fetchCategories();
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load categories.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-headline-lg">Add product</h1>
      <NewProductForm categories={categories} />
    </div>
  );
}
