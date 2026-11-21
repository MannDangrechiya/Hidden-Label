import { describe, expect, it, vi } from "vitest";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { MedusaContainer } from "@medusajs/framework/types";
import { sendOrderPlacedEmail, sendOrderCanceledEmail, sendOrderShippedEmail } from "./order-email";
import * as emailModule from "./email";

describe("Order email notifications (apps/backend/src/lib/order-email.ts)", () => {
  it("formats and triggers order placed email using order_summary totals", async () => {
    const sendEmailSpy = vi.spyOn(emailModule, "sendEmail").mockResolvedValue({
      sent: true,
      status: "sent",
      messageId: "msg_test_123",
    });

    const mockPg = ((table: string) => {
      if (table === "order") {
        return {
          where: () => ({
            first: async () => ({
              id: "order_test_unit_01",
              display_id: 101,
              email: "buyer@thehiddenlabel.test",
              shipping_address_id: "addr_01",
              metadata: {},
            }),
            update: async () => 1,
          }),
        };
      }
      if (table === "order_summary") {
        return {
          where: () => ({
            orderBy: () => ({
              first: async () => ({
                totals: { current_order_total: 18878.82 },
              }),
            }),
          }),
        };
      }
      if (table === "order_address") {
        return {
          where: () => ({
            first: async () => ({ phone: "+919876543210" }),
          }),
        };
      }
      if (table.startsWith("order_line_item")) {
        return {
          join: () => ({
            where: () => ({
              whereNull: () => ({
                select: async () => [
                  {
                    product_title: "Gel-Kayano 14",
                    title: "UK 8.0",
                    quantity: 1,
                    unit_price: 15999,
                  },
                ],
              }),
            }),
          }),
        };
      }
      if (table === "audit_event") {
        return { insert: async () => 1 };
      }
      return { where: () => ({ first: async () => null, select: async () => [] }) };
    }) as unknown;

    const mockContainer = {
      resolve: (key: string) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION) return mockPg;
        if (key === ContainerRegistrationKeys.LOGGER) {
          return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        }
        return null;
      },
    } as unknown as MedusaContainer;

    const outcome = await sendOrderPlacedEmail(mockContainer, "order_test_unit_01");

    expect(outcome.status).toBe("sent");
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    const callArg = sendEmailSpy.mock.calls[0][0];
    expect(callArg.to).toBe("buyer@thehiddenlabel.test");
    expect(callArg.subject).toContain("Order THL-101 confirmed");
    expect(callArg.text).toContain("THL-101 is confirmed. Total ₹18,878.82.");
    expect(callArg.html).toContain("Gel-Kayano 14");
    expect(callArg.html).toContain("₹18,878.82");

    sendEmailSpy.mockRestore();
  });

  it("prevents duplicate email delivery if notification was already sent", async () => {
    const sendEmailSpy = vi.spyOn(emailModule, "sendEmail").mockResolvedValue({
      sent: true,
      status: "sent",
    });

    const mockPg = ((table: string) => {
      if (table === "order") {
        return {
          where: () => ({
            first: async () => ({
              id: "order_test_unit_dup",
              display_id: 104,
              email: "buyer@thehiddenlabel.test",
              shipping_address_id: null,
              metadata: {
                notification_email_order_placed: {
                  status: "sent",
                  message_id: "msg_existing_111",
                },
              },
            }),
            update: async () => 1,
          }),
        };
      }
      if (table === "order_summary") {
        return {
          where: () => ({
            orderBy: () => ({
              first: async () => ({
                totals: { current_order_total: 15000 },
              }),
            }),
          }),
        };
      }
      return { where: () => ({ first: async () => null }) };
    }) as unknown;

    const mockContainer = {
      resolve: (key: string) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION) return mockPg;
        if (key === ContainerRegistrationKeys.LOGGER) {
          return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        }
        return null;
      },
    } as unknown as MedusaContainer;

    const outcome = await sendOrderPlacedEmail(mockContainer, "order_test_unit_dup");
    expect(outcome.status).toBe("skipped_duplicate");
    expect(sendEmailSpy).not.toHaveBeenCalled();

    sendEmailSpy.mockRestore();
  });

  it("records skipped_unconfigured status when provider is not configured", async () => {
    const sendEmailSpy = vi.spyOn(emailModule, "sendEmail").mockResolvedValue({
      sent: false,
      status: "skipped_unconfigured",
      reason: "RESEND_API_KEY is not configured.",
    });

    let recordedMetadata: string | null = null;
    let recordedAudit: Record<string, unknown> | null = null;

    const mockPg = ((table: string) => {
      if (table === "order") {
        return {
          where: () => ({
            first: async () => ({
              id: "order_test_unit_unconfigured",
              display_id: 105,
              email: "buyer@thehiddenlabel.test",
              shipping_address_id: null,
              metadata: {},
            }),
            update: async (data: { metadata?: string }) => {
              recordedMetadata = data.metadata ?? null;
            },
          }),
        };
      }
      if (table === "order_summary") {
        return {
          where: () => ({
            orderBy: () => ({
              first: async () => ({
                totals: { current_order_total: 15000 },
              }),
            }),
          }),
        };
      }
      if (table === "audit_event") {
        return {
          insert: async (data: Record<string, unknown>) => {
            recordedAudit = data;
          },
        };
      }
      return { where: () => ({ first: async () => null }) };
    }) as unknown;

    const mockContainer = {
      resolve: (key: string) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION) return mockPg;
        if (key === ContainerRegistrationKeys.LOGGER) {
          return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        }
        return null;
      },
    } as unknown as MedusaContainer;

    const outcome = await sendOrderPlacedEmail(mockContainer, "order_test_unit_unconfigured");
    expect(outcome.status).toBe("skipped_unconfigured");
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);

    expect(recordedMetadata).toContain("skipped_unconfigured");
    expect(recordedAudit.action).toBe("email.order_placed.skipped_unconfigured");

    sendEmailSpy.mockRestore();
  });

  it("handles cancelled order notification email gracefully", async () => {
    const sendEmailSpy = vi.spyOn(emailModule, "sendEmail").mockResolvedValue({
      sent: true,
      status: "sent",
    });

    const mockPg = ((table: string) => {
      if (table === "order") {
        return {
          where: () => ({
            first: async () => ({
              id: "order_test_unit_cancel",
              display_id: 102,
              email: "buyer@thehiddenlabel.test",
              shipping_address_id: null,
            }),
          }),
        };
      }
      if (table === "order_summary") {
        return {
          where: () => ({
            orderBy: () => ({
              first: async () => ({
                totals: { current_order_total: 15000 },
              }),
            }),
          }),
        };
      }
      return { where: () => ({ first: async () => null }) };
    }) as unknown;

    const mockContainer = {
      resolve: (key: string) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION) return mockPg;
        if (key === ContainerRegistrationKeys.LOGGER) {
          return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        }
        return null;
      },
    } as unknown as MedusaContainer;

    await sendOrderCanceledEmail(mockContainer, "order_test_unit_cancel");

    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailSpy.mock.calls[0][0].subject).toContain("Order THL-102 cancelled");

    sendEmailSpy.mockRestore();
  });

  it("handles shipped order notification email gracefully", async () => {
    const sendEmailSpy = vi.spyOn(emailModule, "sendEmail").mockResolvedValue({
      sent: true,
      status: "sent",
    });

    const mockPg = ((table: string) => {
      if (table === "order") {
        return {
          where: () => ({
            first: async () => ({
              id: "order_test_unit_shipped",
              display_id: 103,
              email: "buyer@thehiddenlabel.test",
              shipping_address_id: null,
            }),
          }),
        };
      }
      if (table === "order_summary") {
        return {
          where: () => ({
            orderBy: () => ({
              first: async () => ({
                totals: { current_order_total: 15000 },
              }),
            }),
          }),
        };
      }
      if (table === "shipment") {
        return {
          where: () => ({
            whereNull: () => ({
              orderBy: () => ({
                first: async () => ({ awb: "AWB12345678", courier: "BlueDart", status: "manifested" }),
              }),
            }),
          }),
        };
      }
      return { where: () => ({ first: async () => null }) };
    }) as unknown;

    const mockContainer = {
      resolve: (key: string) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION) return mockPg;
        if (key === ContainerRegistrationKeys.LOGGER) {
          return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        }
        return null;
      },
    } as unknown as MedusaContainer;

    await sendOrderShippedEmail(mockContainer, "order_test_unit_shipped");

    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailSpy.mock.calls[0][0].subject).toContain("Order THL-103 is on its way");

    sendEmailSpy.mockRestore();
  });
});
