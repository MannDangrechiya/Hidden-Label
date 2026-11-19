/**
 * GAP-SMS-01 / GAP-SMS-03: real SMS delivery for phone OTP.
 *
 * India requires DLT registration. MSG91 is the primary provider: the sender header and the
 * OTP content template are registered on the DLT portal and referenced here by
 * `OTP_SENDER_ID` and `OTP_TEMPLATE_ID`. Twilio is supported as a secondary provider.
 *
 * Nothing here fabricates a delivery. Without a configured provider `isSmsConfigured()` is
 * false, the OTP route answers 501, and the storefront falls back to an email code while
 * telling the customer that it did.
 */
export type SmsProvider = "msg91" | "twilio";

export interface SmsResult {
  sent: boolean;
  reason?: string;
}

export function smsProvider(): SmsProvider | null {
  const configured = (process.env.OTP_PROVIDER ?? "").trim().toLowerCase();
  if (configured === "msg91" || configured === "twilio") return configured;
  return null;
}

export function isSmsConfigured(): boolean {
  const provider = smsProvider();
  if (provider === "msg91") {
    return Boolean(process.env.OTP_API_KEY && process.env.OTP_TEMPLATE_ID);
  }
  if (provider === "twilio") {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
  }
  return false;
}

/** Digits-only recipient in the form Indian gateways expect (`919876543210`). */
function gatewayNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}

async function sendViaMsg91(to: string, code: string): Promise<SmsResult> {
  const authKey = process.env.OTP_API_KEY;
  const templateId = process.env.OTP_TEMPLATE_ID;
  if (!authKey || !templateId) {
    return { sent: false, reason: "MSG91 auth key or DLT template id is missing." };
  }

  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: { "content-type": "application/json", authkey: authKey },
    body: JSON.stringify({
      template_id: templateId,
      short_url: "0",
      // The DLT-registered template must expose a variable named OTP.
      recipients: [{ mobiles: gatewayNumber(to), OTP: code }],
      sender: process.env.OTP_SENDER_ID ?? undefined,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await response.text();
    return { sent: false, reason: `MSG91 ${response.status}: ${body.slice(0, 180)}` };
  }

  return { sent: true };
}

async function sendViaTwilio(to: string, code: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    return { sent: false, reason: "Twilio credentials are incomplete." };
  }

  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: `Your The Hidden Label verification code is ${code}. It expires in 5 minutes.`,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const text = await response.text();
    return { sent: false, reason: `Twilio ${response.status}: ${text.slice(0, 180)}` };
  }

  return { sent: true };
}

export async function sendOtpSms(to: string, code: string): Promise<SmsResult> {
  const provider = smsProvider();
  if (!provider || !isSmsConfigured()) {
    return { sent: false, reason: "No SMS provider is configured (OTP_PROVIDER / OTP_API_KEY)." };
  }

  try {
    return provider === "msg91" ? await sendViaMsg91(to, code) : await sendViaTwilio(to, code);
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "SMS request failed.",
    };
  }
}
