/**
 * Order-status WhatsApp notifications. MSG91's WhatsApp API is the provider — the business
 * already holds an MSG91 account for SMS OTP (`lib/sms.ts`), so this reuses the same vendor
 * relationship instead of adding a second one, via a DLT-exempt (WhatsApp is not an SMS route)
 * but still Meta-approved message template.
 *
 * Nothing here fabricates delivery. Unconfigured or failing sends are logged and never block an
 * order transition — WhatsApp is a convenience channel alongside email, not the only one.
 */
export interface WhatsappResult {
  sent: boolean;
  reason?: string;
}

export function isWhatsappConfigured(): boolean {
  return Boolean(process.env.MSG91_WHATSAPP_AUTH_KEY && process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER);
}

/** Digits-only recipient in the form MSG91's WhatsApp API expects (`919876543210`). */
function gatewayNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}

/**
 * Sends a DLT/Meta-approved template message. `templateName` must already be approved in the
 * MSG91 WhatsApp dashboard; `params` fill its numbered placeholders in order.
 */
export async function sendWhatsappTemplate(
  to: string,
  templateName: string,
  params: string[],
): Promise<WhatsappResult> {
  const authKey = process.env.MSG91_WHATSAPP_AUTH_KEY;
  const integratedNumber = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER;
  if (!authKey || !integratedNumber) {
    return { sent: false, reason: "MSG91 WhatsApp credentials are not configured." };
  }

  try {
    const response = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
      method: "POST",
      headers: { "content-type": "application/json", authkey: authKey },
      body: JSON.stringify({
        integrated_number: integratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: templateName,
            language: { code: "en", policy: "deterministic" },
            to_and_components: [
              {
                to: [gatewayNumber(to)],
                components: {
                  body_1: Object.fromEntries(params.map((value, i) => [`var${i + 1}`, { value }])),
                },
              },
            ],
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      return { sent: false, reason: `MSG91 WhatsApp ${response.status}: ${body.slice(0, 180)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "WhatsApp request failed." };
  }
}
