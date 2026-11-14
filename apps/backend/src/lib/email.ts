/**
 * Transactional email through Resend when RESEND_API_KEY is configured. Without it the message
 * is logged (no provider in local development) and the caller continues — an email failure must
 * never block an order transition (docs/INTEGRATIONS.md §3).
 */
export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(input: EmailInput): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "orders@thehiddenlabel.com";

  if (!apiKey) {
    // Local/dev: visibly recorded, never silently dropped.
    console.info(`[email:not-configured] to=${input.to} subject="${input.subject}"`);
    return { sent: false, reason: "RESEND_API_KEY is not configured." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      return { sent: false, reason: `Resend ${response.status}: ${body.slice(0, 200)}` };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Email request failed.",
    };
  }
}

export function orderEmailHtml(input: {
  heading: string;
  intro: string;
  orderDisplayId: string;
  total: string;
  lines: { title: string; quantity: number; price: string }[];
}): string {
  return `<!doctype html><html><body style="font-family:Helvetica,Arial,sans-serif;background:#f8f7f4;padding:32px;color:#111">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;padding:32px">
    <p style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#71717a;margin:0 0 24px">The Hidden Label</p>
    <h1 style="font-size:24px;margin:0 0 12px">${input.heading}</h1>
    <p style="font-size:14px;line-height:22px;color:#444748">${input.intro}</p>
    <p style="font-family:monospace;font-size:13px;margin:24px 0 8px">Order ${input.orderDisplayId}</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${input.lines
        .map(
          (line) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7">${line.title} × ${line.quantity}</td><td style="text-align:right;border-bottom:1px solid #e4e4e7">${line.price}</td></tr>`,
        )
        .join("")}
      <tr><td style="padding:12px 0;font-weight:600">Total</td><td style="text-align:right;font-weight:600">${input.total}</td></tr>
    </table>
    <p style="font-size:12px;color:#71717a;margin-top:24px">Questions? Reply to this message or contact support from your account.</p>
  </div>
</body></html>`;
}
