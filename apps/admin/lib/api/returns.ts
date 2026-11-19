import "server-only";
import { backendFetch } from "../backend";

export type ReturnStatus =
  | "requested"
  | "approved"
  | "in_transit"
  | "received"
  | "inspecting"
  | "refunded"
  | "rejected"
  | "closed";

export interface ReturnRequest {
  id: string;
  display_id: string;
  order_id: string;
  order_display_id: string;
  customer_email: string;
  status: ReturnStatus;
  reason_code: string;
  reason_note: string | null;
  resolution: string;
  awb: string | null;
  courier: string | null;
  refund_amount: string | null;
  requested_at: string;
  approved_at: string | null;
  received_at: string | null;
  closed_at: string | null;
  condition: string | null;
  condition_note: string | null;
  restocked_at: string | null;
}

export type ReturnAction = "approve" | "reject" | "receive" | "refund";

/** GET /admin/returns?status= — backs A-12. */
export async function fetchReturns(status?: string): Promise<ReturnRequest[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const { returns } = await backendFetch<{ returns: ReturnRequest[] }>(`/admin/returns${qs}`);
  return returns;
}

/** POST /admin/returns/:id — approve | reject | receive | refund. */
export async function actOnReturn(
  id: string,
  action: ReturnAction,
  note?: string,
  condition?: string,
): Promise<ReturnRequest> {
  const { return: updated } = await backendFetch<{ return: ReturnRequest }>(
    `/admin/returns/${id}`,
    { method: "POST", body: { action, note, condition } },
  );
  return updated;
}
