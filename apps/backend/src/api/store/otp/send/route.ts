import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { sendEmail } from "../../../../lib/email";
import { isEmail, normalizeIndianPhone } from "../../../../lib/phone";
import { isSmsConfigured, sendOtpSms } from "../../../../lib/sms";
import {
  generateCode,
  hashCode,
  OTP_MAX_SENDS,
  OTP_SEND_WINDOW_MS,
  OTP_TTL_MS,
  destinationRef,
} from "../../../../lib/otp";
import { THL_MODULE } from "../../../../modules/thl";
import type ThlModuleService from "../../../../modules/thl/service";

interface Body {
  destination?: string;
  channel?: "email" | "sms";
  purpose?: string;
}

/**
 * POST /store/otp/send — rate-limited code dispatch. Never reveals whether an address exists.
 *
 * GAP-SMS-01/02/03: SMS destinations are normalised from any common Indian format to E.164
 * and delivered through MSG91 (DLT template) or Twilio. With no provider configured the route
 * answers 501 instead of pretending to send, so the storefront can honestly fall back to email.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const rawDestination = (req.body?.destination ?? "").trim();
  const channel = req.body?.channel ?? "email";
  const purpose = req.body?.purpose ?? "phone_verify";

  if (!rawDestination || !["email", "sms"].includes(channel)) {
    res.status(400).json({
      type: "invalid_data",
      message: "A destination and a channel (email or sms) are required.",
    });
    return;
  }

  let destination = rawDestination;

  if (channel === "email" && !isEmail(destination)) {
    res.status(400).json({ type: "invalid_data", message: "Enter a valid email address." });
    return;
  }

  if (channel === "sms") {
    const normalised = normalizeIndianPhone(rawDestination);
    if (!normalised) {
      res.status(400).json({
        type: "invalid_data",
        message: "Enter a valid mobile number, for example 9876543210 or +919876543210.",
      });
      return;
    }
    destination = normalised;
  }

  const recent = await thl.listOtpChallenges(
    {
      destination,
      purpose,
    },
    { take: 1, order: { created_at: "DESC" } },
  );

  const last = recent[0];
  if (last && Date.now() - new Date(last.created_at as unknown as string).getTime() < OTP_SEND_WINDOW_MS) {
    const count = await thl.listOtpChallenges({
      destination,
      purpose,
    });
    const inWindow = count.filter(
      (row) =>
        Date.now() - new Date(row.created_at as unknown as string).getTime() < OTP_SEND_WINDOW_MS,
    );
    if (inWindow.length >= OTP_MAX_SENDS) {
      res.status(429).json({
        type: "rate_limited",
        message: "Too many codes requested. Try again in 15 minutes.",
      });
      return;
    }
  }

  if (channel === "sms" && !isSmsConfigured()) {
    res.status(501).json({
      type: "not_configured",
      message: "SMS one-time codes are not configured on this environment.",
    });
    return;
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const challenge = await thl.createOtpChallenges({
    purpose,
    channel,
    destination,
    code_hash: hashCode(destination, code),
    expires_at: expiresAt,
    max_attempts: 5,
    ip: req.ip ?? null,
  });

  let delivery: { sent: boolean; reason?: string } = { sent: false };
  if (channel === "email") {
    delivery = await sendEmail({
      to: destination,
      subject: "Your The Hidden Label verification code",
      html: `<p>Your verification code is <strong style="font-size:22px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 5 minutes. If you did not request it, ignore this message.</p>`,
      text: `Your verification code is ${code}. It expires in 5 minutes.`,
    });
  } else {
    delivery = await sendOtpSms(destination, code);
  }

  logger.info(
    `otp issued ref=${destinationRef(destination)} purpose=${purpose} channel=${channel} delivered=${delivery.sent}`,
  );

  const exposeDevCode =
    process.env.OTP_DEV_ECHO === "true" && process.env.NODE_ENV !== "production";

  res.status(201).json({
    challenge_id: challenge.id,
    expires_at: expiresAt.toISOString(),
    channel,
    destination,
    delivered: delivery.sent,
    ...(delivery.sent ? {} : { delivery_note: delivery.reason ?? "Provider not configured." }),
    ...(exposeDevCode ? { dev_code: code } : {}),
  });
}
