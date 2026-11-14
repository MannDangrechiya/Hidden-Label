import { model } from "@medusajs/framework/utils";

/** Hashed, rate-limited one-time code. Table: otp_challenge. */
export const OtpChallenge = model.define("otp_challenge", {
  id: model.id({ prefix: "otp" }).primaryKey(),
  purpose: model.text(),
  channel: model.text(),
  destination: model.text(),
  code_hash: model.text(),
  attempts: model.number().default(0),
  max_attempts: model.number().default(5),
  expires_at: model.dateTime(),
  consumed_at: model.dateTime().nullable(),
  ip: model.text().nullable(),
});
