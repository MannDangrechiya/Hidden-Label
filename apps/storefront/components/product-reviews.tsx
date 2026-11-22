"use client";

import { useState, useTransition } from "react";

export interface ReviewItem {
  id: string;
  rating: number;
  title: string;
  body: string;
  author_name: string;
  verified_purchase: boolean;
  created_at: string;
}

export interface ReviewStats {
  count: number;
  average_rating: number;
  distribution: Record<number, number>;
}

interface ProductReviewsProps {
  productId: string;
  initialReviews?: ReviewItem[];
  initialStats?: ReviewStats;
}

export function ProductReviews({
  productId,
  initialReviews = [],
  initialStats = { count: 0, average_rating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
}: ProductReviewsProps) {
  const [reviews] = useState<ReviewItem[]>(initialReviews);
  const [stats] = useState<ReviewStats>(initialStats);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/products/${productId}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, title, body, author_name: authorName }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to submit review.");
        }
        setStatusMessage("Thank you. Your review has been submitted for moderation.");
        setTimeout(() => {
          setIsModalOpen(false);
          setStatusMessage(null);
        }, 2000);
      } catch (err) {
        setStatusMessage(err instanceof Error ? err.message : "Error submitting review.");
      }
    });
  };

  return (
    <div className="border-t border-line py-12 mt-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-tight text-ink mb-1">
            Client Reviews &amp; Ratings
          </h2>
          <p className="font-sans text-xs text-muted">
            Authentic feedback from verified luxury clients.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="border border-ink bg-ink text-paper hover:bg-ink/90 font-mono text-xs uppercase tracking-widest px-6 py-3 transition-colors"
        >
          Write a Review
        </button>
      </div>

      {stats.count > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 pb-8 border-b border-line">
          <div className="flex flex-col items-center justify-center p-6 border border-line bg-surface/30">
            <span className="font-display text-5xl font-bold text-ink">{stats.average_rating}</span>
            <div className="flex items-center text-amber-500 my-2 text-lg">
              {"★".repeat(Math.round(stats.average_rating))}
              {"☆".repeat(5 - Math.round(stats.average_rating))}
            </div>
            <span className="font-mono text-xs text-muted">
              Based on {stats.count} verified {stats.count === 1 ? "review" : "reviews"}
            </span>
          </div>

          <div className="col-span-2 flex flex-col justify-center gap-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.distribution[star] || 0;
              const pct = stats.count > 0 ? (count / stats.count) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3 font-mono text-xs text-muted">
                  <span className="w-8">{star} ★</span>
                  <div className="flex-1 h-2 bg-surface-container overflow-hidden">
                    <div className="h-full bg-ink transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border border-line bg-surface/20 p-8 text-center font-sans text-xs text-muted mb-8">
          No reviews yet — be the first verified client to review this piece.
        </div>
      )}

      {reviews.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((rev) => (
            <div key={rev.id} className="border border-line p-5 bg-white">
              <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-amber-500 text-sm">
                    {"★".repeat(rev.rating)}
                    {"☆".repeat(5 - rev.rating)}
                  </span>
                  <span className="font-mono text-[11px] text-muted">{rev.rating}/5</span>
                </div>
                {rev.verified_purchase && (
                  <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] uppercase font-semibold text-emerald-700">
                    Verified Buyer
                  </span>
                )}
              </div>
              <h4 className="font-display text-sm font-semibold text-ink mb-1">{rev.title}</h4>
              <p className="font-sans text-xs text-ink/80 leading-relaxed mb-4">{rev.body}</p>
              <div className="flex items-center justify-between font-mono text-[10px] text-muted border-t border-line pt-2">
                <span>{rev.author_name}</span>
                <span>{new Date(rev.created_at).toLocaleDateString("en-IN")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Submission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-line p-6 max-w-lg w-full relative">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 font-mono text-xs uppercase text-muted hover:text-ink"
            >
              Close [✕]
            </button>
            <h3 className="font-display text-lg uppercase tracking-tight text-ink mb-2">
              Review This Silhouette
            </h3>
            <p className="font-sans text-xs text-muted mb-4">
              Share your assessment of drape, craftsmanship, and fit.
            </p>

            {statusMessage && (
              <div className="border border-line p-3 mb-4 font-mono text-xs bg-surface-container text-ink">
                {statusMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block font-mono text-xs uppercase text-muted mb-1">
                  Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`text-2xl transition-colors ${
                        star <= rating ? "text-amber-500" : "text-muted/40"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="font-mono text-xs text-muted">({rating} Stars)</span>
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase text-muted mb-1">
                  Review Headline
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Masterful tailoring, exquisite drape"
                  className="w-full border border-line p-2 font-sans text-xs focus:border-ink focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase text-muted mb-1">
                  Detailed Assessment
                </label>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe fabric handfeel, silhouette structure, and sizing accuracy..."
                  className="w-full border border-line p-2 font-sans text-xs focus:border-ink focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase text-muted mb-1">
                  Your Name / Signature
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g. Vikram S."
                  className="w-full border border-line p-2 font-sans text-xs focus:border-ink focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="border border-line px-4 py-2 font-mono text-xs uppercase text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-ink text-paper hover:bg-ink/90 font-mono text-xs uppercase px-6 py-2 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
