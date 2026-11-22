import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchAdminReviews } from "../../../lib/api/reviews";
import { BackendError } from "../../../lib/backend";
import { ReviewCard } from "./review-card";

export const metadata: Metadata = { title: "Product Reviews Moderation" };

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const currentStatus = params?.status || "pending";

  let reviews;
  try {
    reviews = await fetchAdminReviews(currentStatus);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load review queue.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-headline-lg">Product Reviews Moderation</h1>
          <p className="font-sans text-body-sm text-muted">
            Truthful reviews and ratings gate. Only approved reviews render publicly on product detail pages.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <a
            href="/reviews?status=pending"
            className={`px-3 py-1.5 border transition-colors ${
              currentStatus === "pending"
                ? "bg-ink text-paper border-ink font-semibold"
                : "bg-white text-ink border-line hover:border-ink"
            }`}
          >
            Pending Queue
          </a>
          <a
            href="/reviews?status=approved"
            className={`px-3 py-1.5 border transition-colors ${
              currentStatus === "approved"
                ? "bg-ink text-paper border-ink font-semibold"
                : "bg-white text-ink border-line hover:border-ink"
            }`}
          >
            Approved
          </a>
          <a
            href="/reviews?status=rejected"
            className={`px-3 py-1.5 border transition-colors ${
              currentStatus === "rejected"
                ? "bg-ink text-paper border-ink font-semibold"
                : "bg-white text-ink border-line hover:border-ink"
            }`}
          >
            Rejected
          </a>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="border border-line bg-white p-12 text-center font-sans text-sm text-muted">
          No reviews in the {currentStatus} queue.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
