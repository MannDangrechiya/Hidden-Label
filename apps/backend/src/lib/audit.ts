import type { Knex } from "knex";

export interface AuditInput {
  actorType: "admin" | "customer" | "system" | "webhook";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  changes?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Insert one audit row. Pass the same knex transaction as the mutation to make the record and
 * the change atomic (docs/DATABASE_PLAN.md §6). The table rejects UPDATE and DELETE with a
 * trigger, so there is no edit path even for the application role.
 *
 * `changes` must never contain secrets or full payment payloads — ids and amounts only.
 */
export async function writeAudit(db: Knex, input: AuditInput): Promise<void> {
  await db("audit_event").insert({
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    summary: input.summary,
    changes: JSON.stringify(input.changes ?? {}),
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
  });
}

export function requestMeta(req: {
  ip?: string;
  headers: Record<string, unknown>;
}): { ip: string | null; userAgent: string | null } {
  const agent = req.headers["user-agent"];
  return {
    ip: req.ip ?? null,
    userAgent: typeof agent === "string" ? agent.slice(0, 300) : null,
  };
}
