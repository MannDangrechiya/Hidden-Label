import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { actorId } from "../../../../lib/auth";

interface CustomerFitBody {
  foot_length_cm?: number;
  foot_width?: string;
  standard_uk_size?: number;
  notes?: string;
}

/**
 * GET /store/fit/profile — Retrieve authenticated customer's foot profile.
 * POST /store/fit/profile — Save or update customer's foot profile.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to view your fit profile." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const profile = await pg("customer_fit_profile")
    .where({ customer_id: customerId })
    .whereNull("deleted_at")
    .first();

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    profile: profile
      ? {
          foot_length_cm: profile.foot_length_cm ? Number(profile.foot_length_cm) : null,
          foot_width: profile.foot_width,
          standard_uk_size: profile.standard_uk_size ? Number(profile.standard_uk_size) : null,
          notes: profile.notes,
          updated_at: profile.updated_at,
        }
      : null,
  });
}

export async function POST(req: MedusaRequest<CustomerFitBody>, res: MedusaResponse) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to save your fit profile." });
    return;
  }

  const { foot_length_cm, foot_width = "regular", standard_uk_size, notes } = req.body ?? {};
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const existing = await pg("customer_fit_profile")
    .where({ customer_id: customerId })
    .first();

  if (existing) {
    await pg("customer_fit_profile")
      .where({ customer_id: customerId })
      .update({
        foot_length_cm: foot_length_cm ?? existing.foot_length_cm,
        foot_width: foot_width ?? existing.foot_width,
        standard_uk_size: standard_uk_size ?? existing.standard_uk_size,
        notes: notes !== undefined ? notes : existing.notes,
        updated_at: new Date(),
      });
  } else {
    await pg("customer_fit_profile").insert({
      id: generateEntityId(undefined, "cfp"),
      customer_id: customerId,
      foot_length_cm: foot_length_cm ?? null,
      foot_width,
      standard_uk_size: standard_uk_size ?? null,
      notes: notes ?? null,
    });
  }

  const updated = await pg("customer_fit_profile")
    .where({ customer_id: customerId })
    .first();

  res.json({
    profile: {
      foot_length_cm: updated.foot_length_cm ? Number(updated.foot_length_cm) : null,
      foot_width: updated.foot_width,
      standard_uk_size: updated.standard_uk_size ? Number(updated.standard_uk_size) : null,
      notes: updated.notes,
      updated_at: updated.updated_at,
    },
  });
}
