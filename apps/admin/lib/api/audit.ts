import "server-only";
import { backendFetch } from "../backend";

export interface AuditEvent {
  id: number;
  occurred_at: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  changes: Record<string, unknown>;
  ip: string | null;
}

export interface AuditFilters {
  entity_type?: string;
  entity_id?: string;
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditPage {
  events: AuditEvent[];
  count: number;
  offset: number;
  limit: number;
  note: string;
}

/** GET /admin/audit — backs A-17, read-only. */
export async function fetchAuditEvents(filters: AuditFilters = {}): Promise<AuditPage> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return backendFetch<AuditPage>(`/admin/audit${qs ? `?${qs}` : ""}`);
}
