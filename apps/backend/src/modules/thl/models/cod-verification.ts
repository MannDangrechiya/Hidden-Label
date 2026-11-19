import { model } from "@medusajs/framework/utils";

/**
 * GAP-SEC-02 fix: the Cash-on-Delivery OTP proof is written only by
 * `POST /store/carts/:id/verify-cod` after a real, unconsumed `otp_challenge` row was
 * solved. A client can no longer forge it by writing cart metadata, because the cart
 * update middleware strips the reserved metadata keys and order completion reads this
 * table instead of `cart.metadata`.
 *
 * Table: cod_verification.
 */
export const CodVerification = model.define("cod_verification", {
  id: model.id({ prefix: "codv" }).primaryKey(),
  cart_id: model.text(),
  phone: model.text(),
  challenge_id: model.text(),
  verified_at: model.dateTime(),
  consumed_at: model.dateTime().nullable(),
});
