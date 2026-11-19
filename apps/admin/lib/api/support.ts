import "server-only";
import { backendFetch } from "../backend";

export interface SupportTicket {
  id: string;
  display_id: string;
  customer_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  order_id: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}

/** GET /admin/support/tickets — backs A-21. */
export async function fetchSupportTickets(status?: string): Promise<SupportTicket[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const { tickets } = await backendFetch<{ tickets: SupportTicket[] }>(`/admin/support/tickets${qs}`);
  return tickets;
}
