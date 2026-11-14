import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchPromotion } from "../../../../lib/api/promotions";
import { BackendError } from "../../../../lib/backend";
import { PromotionForm } from "../promotion-form";

export const metadata: Metadata = { title: "Edit promotion" };

export default async function PromotionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let promotion;
  try {
    promotion = await fetchPromotion(id);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load this promotion.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">{promotion.code ?? "Automatic promotion"}</h1>
      <PromotionForm promotion={promotion} />
    </div>
  );
}
