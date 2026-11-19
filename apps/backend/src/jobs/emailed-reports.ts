import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { toCsv } from "../lib/csv";
import { sendEmail } from "../lib/email";

/**
 * MF-28: a scheduled, emailed orders digest — the admin Reports page's CSV export is on-demand
 * only, with nothing sent automatically. Runs daily (server time) and is a no-op without
 * REPORTS_EMAIL, the same "silent until configured" pattern as every other notification here.
 */
export default async function emailedReportsJob(container: MedusaContainer): Promise<void> {
  const to = process.env.REPORTS_EMAIL;
  if (!to) return;

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const orders = (await pg("order")
    .whereNull("deleted_at")
    .andWhere("created_at", ">=", since)
    .orderBy("created_at", "asc")
    .select("display_id", "email", "status", "total", "currency_code", "created_at")) as {
    display_id: number | string;
    email: string | null;
    status: string;
    total: number | string;
    currency_code: string;
    created_at: Date;
  }[];

  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const csv = toCsv(
    ["order", "email", "status", "total", "currency", "created_at"],
    orders.map((order) => [
      order.display_id,
      order.email ?? "",
      order.status,
      order.total,
      order.currency_code,
      order.created_at.toISOString(),
    ]),
  );

  const result = await sendEmail({
    to,
    subject: `The Hidden Label — daily orders report (${orders.length} orders, ₹${revenue.toLocaleString("en-IN")})`,
    html: `<p>${orders.length} order(s) in the last 24 hours, totalling ₹${revenue.toLocaleString(
      "en-IN",
    )}. The full detail is attached as CSV.</p>`,
    text: `${orders.length} order(s) in the last 24 hours, totalling ₹${revenue.toLocaleString("en-IN")}.`,
    attachments: [
      {
        filename: `orders-${new Date().toISOString().slice(0, 10)}.csv`,
        content: Buffer.from(csv, "utf-8").toString("base64"),
      },
    ],
  });

  if (!result.sent) {
    logger.info(`Daily orders report email skipped: ${result.reason ?? "not configured"}`);
  }
}

export const config = {
  name: "emailed-daily-orders-report",
  // 07:00 server time, every day. Adjust to the deployment's timezone as needed.
  schedule: "0 7 * * *",
};
