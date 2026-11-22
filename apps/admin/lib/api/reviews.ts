import "server-only";
import { backendFetch } from "../backend";

export interface AdminReview {
  id: string;
  product_id: string;
  customer_id: string;
  rating: number;
  title: string;
  body: string;
  author_name: string;
  verified_purchase: boolean;
  status: "pending" | "approved" | "rejected";
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
}

export async function fetchAdminReviews(status?: string): Promise<AdminReview[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await backendFetch<{ reviews: AdminReview[] }>(`/admin/reviews${query}`);
  return data.reviews ?? [];
}

export async function moderateReviewAction(
  reviewId: string,
  action: "approve" | "reject",
): Promise<AdminReview> {
  const data = await backendFetch<{ review: AdminReview }>(`/admin/reviews/${reviewId}/action`, {
    method: "POST",
    body: { action },
  });
  return data.review;
}
