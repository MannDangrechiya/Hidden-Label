import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { randomBytes } from "node:crypto";
import { requireRole } from "../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../lib/audit";

interface CreateSupplierBody {
  name?: string;
  contact_email?: string;
  contact_phone?: string;
  gstin?: string;
  address?: string;
}

/**
 * GET /admin/suppliers — List luxury suppliers and vendor partners (Phase 6).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const suppliers = await pg("supplier").orderBy("name", "asc");

  res.json({ suppliers });
}

/**
 * POST /admin/suppliers — Create a new luxury supplier profile.
 */
export async function POST(req: MedusaRequest<CreateSupplierBody>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const body = req.body ?? {};
  const name = body.name?.trim();
  const contactEmail = body.contact_email?.trim();

  if (!name || name.length < 2) {
    res.status(400).json({ type: "invalid_data", message: "Supplier name is required." });
    return;
  }

  if (!contactEmail || !contactEmail.includes("@")) {
    res.status(400).json({ type: "invalid_data", message: "A valid supplier contact email is required." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const supplierId = `sup_${randomBytes(8).toString("hex")}`;

  const [supplier] = await pg("supplier")
    .insert({
      id: supplierId,
      name,
      contact_email: contactEmail,
      contact_phone: body.contact_phone?.trim() || null,
      gstin: body.gstin?.trim() || null,
      address: body.address?.trim() || null,
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning("*");

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "supplier.create",
    entityType: "supplier",
    entityId: supplierId,
    summary: `Supplier ${name} created by ${actor.email ?? actor.id}`,
    changes: { name, contact_email: contactEmail, gstin: body.gstin },
    ...meta,
  });

  res.status(201).json({ supplier });
}
