import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchCategories } from "../../../lib/api/categories";
import { fetchCurrentAdmin, roleAtLeast } from "../../../lib/api/auth";
import { BackendError } from "../../../lib/backend";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Categories" };

/** A-05 — category management. */
export default async function CategoriesPage() {
  let categories;
  let canWrite = false;
  try {
    [categories, canWrite] = await Promise.all([
      fetchCategories(),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "manager")),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load categories.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">Categories</h1>
      <CategoryManager categories={categories} canWrite={canWrite} />
    </div>
  );
}
