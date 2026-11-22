"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateReviewServerAction } from "./actions";
import type { AdminReview } from "../../../lib/api/reviews";

interface ReviewCardProps {
  review: AdminReview;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleModerate = (action: "approve" | "reject") => {
    startTransition(async () => {
      try {
        await moderateReviewServerAction(review.id, action);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Moderation action failed.");
      }
    });
  };

  const statusBadge = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-rose-100 text-rose-800 border-rose-200",
  }[review.status];

  return (
    <div className="border border-line bg-white p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-ink tracking-tight">
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)}
            </span>
            <span className="font-mono text-xs text-muted">({review.rating}/5)</span>
          </div>
          <div className="flex items-center gap-2">
            {review.verified_purchase && (
              <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] uppercase font-semibold text-emerald-700">
                Verified Buyer
              </span>
            )}
            <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase font-semibold ${statusBadge}`}>
              {review.status}
            </span>
          </div>
        </div>

        <h3 className="font-display text-sm font-semibold text-ink mb-1">{review.title}</h3>
        <p className="font-sans text-xs text-ink/80 leading-relaxed mb-4">{review.body}</p>

        <div className="flex items-center justify-between font-mono text-[11px] text-muted border-t border-line pt-2">
          <span>By: {review.author_name}</span>
          <span>{new Date(review.created_at).toLocaleDateString("en-IN")}</span>
        </div>
      </div>

      {review.status === "pending" && (
        <div className="flex items-center gap-3 pt-3 border-t border-line">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleModerate("approve")}
            className="flex-1 bg-ink text-paper hover:bg-ink/90 font-mono text-xs uppercase py-2 px-3 transition-colors disabled:opacity-50"
          >
            {isPending ? "Updating..." : "Approve"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleModerate("reject")}
            className="flex-1 border border-rose-300 text-rose-700 hover:bg-rose-50 font-mono text-xs uppercase py-2 px-3 transition-colors disabled:opacity-50"
          >
            {isPending ? "Updating..." : "Reject"}
          </button>
        </div>
      )}
    </div>
  );
}
