"use server";

import { revalidatePath } from "next/cache";
import { moderateReviewAction as callModerate } from "../../../lib/api/reviews";

export async function moderateReviewServerAction(
  reviewId: string,
  action: "approve" | "reject",
) {
  const result = await callModerate(reviewId, action);
  revalidatePath("/reviews");
  return result;
}
