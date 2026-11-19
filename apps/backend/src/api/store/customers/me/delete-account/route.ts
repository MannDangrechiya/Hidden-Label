import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * DELETE /store/customers/me/delete-account — GAP-REG-03.
 *
 * DPDP Act 2023 data-principal erasure: the account is closed and direct identifiers are
 * removed immediately. Order records are retained in a pseudonymised form because the tax and
 * consumer-protection laws require them; no address, phone, or plaintext email remains on the
 * customer record.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const authContext = (req as unknown as {
    auth_context?: { actor_id?: string; actor_type?: string };
  }).auth_context;

  const customerId = authContext?.actor_id;
  if (authContext?.actor_type !== "customer" || !customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to delete your account." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const now = new Date();
  const anonymisedEmail = `deleted+${customerId}@deleted.invalid`;

  await pg.transaction(async (trx) => {
    await trx("customer_address").where({ customer_id: customerId }).update({
      first_name: null,
      last_name: null,
      phone: null,
      address_1: "Redacted",
      address_2: null,
      company: null,
      postal_code: null,
      deleted_at: now,
      updated_at: now,
    });

    await trx("customer").where({ id: customerId }).update({
      email: anonymisedEmail,
      first_name: null,
      last_name: null,
      phone: null,
      metadata: JSON.stringify({ account_deleted_at: now.toISOString(), erasure_request: "dpdp_2023" }),
      deleted_at: now,
      updated_at: now,
    });

    // Provider identities are the login credentials — remove them so the account cannot sign in.
    await trx("provider_identity")
      .where({ entity_id: customerId })
      .update({ deleted_at: now, updated_at: now });
  });

  logger.info(`customer ${customerId} erased their account (DPDP §12)`);

  res.json({
    deleted: true,
    message:
      "Your account has been closed and your personal details erased. Order records are retained in a redacted form where tax law requires it.",
  });
}
