"use server";

import { returnRequestSchema } from "@thl/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readAuthToken } from "@/lib/auth-cookie";
import { createReturnRequest, MedusaError } from "@/lib/medusa";
import type { ActionResult } from "@/app/actions/auth";

export async function createReturnAction(formData: FormData): Promise<ActionResult> {
  const token = await readAuthToken();
  if (!token) redirect("/login");

  const orderId = String(formData.get("order_id") ?? "");
  const itemId = String(formData.get("order_item_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);

  const parsed = returnRequestSchema.safeParse({
    order_id: orderId,
    reason_code: formData.get("reason_code"),
    note: formData.get("note") || undefined,
    items: itemId ? [{ order_item_id: itemId, quantity: Number.isFinite(quantity) ? quantity : 1 }] : [],
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the return details." };
  }

  try {
    const created = await createReturnRequest(token, parsed.data);
    revalidatePath(`/account/orders/${orderId}`);
    revalidatePath("/account/orders");
    return { ok: true, message: `Return ${created.display_id} requested.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MedusaError ? error.message : "Could not submit the return request.",
    };
  }
}
