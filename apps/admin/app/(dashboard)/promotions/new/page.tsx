import type { Metadata } from "next";
import { PromotionForm } from "../promotion-form";

export const metadata: Metadata = { title: "New promotion" };

export default function NewPromotionPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">New promotion</h1>
      <PromotionForm />
    </div>
  );
}
