import { describe, expect, it } from "vitest";
import {
  addressSchema,
  forgotPasswordSchema,
  loginSchema,
  otpSendSchema,
  otpVerifySchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  returnRequestSchema,
} from "./schemas";

describe("Validation Schemas (@thl/shared)", () => {
  describe("registerSchema", () => {
    it("accepts valid registration input", () => {
      const result = registerSchema.safeParse({
        first_name: "Sneaker",
        last_name: "Head",
        email: "user@example.com",
        phone: "+919876543210",
        password: "securePassword123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = registerSchema.safeParse({
        first_name: "Sneaker",
        last_name: "Head",
        email: "not-an-email",
        password: "securePassword123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("email");
      }
    });

    it("rejects password shorter than 8 characters", () => {
      const result = registerSchema.safeParse({
        first_name: "Sneaker",
        last_name: "Head",
        email: "user@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-E.164 phone format", () => {
      const result = registerSchema.safeParse({
        first_name: "Sneaker",
        last_name: "Head",
        email: "user@example.com",
        phone: "9876543210", // missing + and country code
        password: "securePassword123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("validates valid credentials", () => {
      expect(loginSchema.safeParse({ email: "user@example.com", password: "pwd" }).success).toBe(true);
    });

    it("rejects empty password", () => {
      expect(loginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
    });
  });

  describe("addressSchema", () => {
    it("accepts valid Indian shipping address", () => {
      const result = addressSchema.safeParse({
        first_name: "Sneaker",
        last_name: "Collector",
        phone: "+919876543210",
        address_1: "Flat 402, High Street Towers",
        city: "Mumbai",
        province: "Maharashtra",
        postal_code: "400001",
        country_code: "in",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid PIN code (not 6 digits)", () => {
      const result = addressSchema.safeParse({
        first_name: "Sneaker",
        last_name: "Collector",
        phone: "+919876543210",
        address_1: "Flat 402",
        city: "Mumbai",
        province: "Maharashtra",
        postal_code: "4000", // invalid
        country_code: "in",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("returnRequestSchema", () => {
    it("accepts valid return request input", () => {
      const result = returnRequestSchema.safeParse({
        order_id: "order_123",
        reason_code: "wrong_size",
        items: [{ order_item_id: "item_456", quantity: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown reason code", () => {
      const result = returnRequestSchema.safeParse({
        order_id: "order_123",
        reason_code: "invalid_reason",
        items: [{ order_item_id: "item_456", quantity: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects zero or negative quantity", () => {
      const result = returnRequestSchema.safeParse({
        order_id: "order_123",
        reason_code: "damaged",
        items: [{ order_item_id: "item_456", quantity: 0 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("otpSendSchema & otpVerifySchema", () => {
    it("accepts valid OTP destination and channel", () => {
      expect(otpSendSchema.safeParse({ destination: "user@example.com", channel: "email" }).success).toBe(true);
      expect(otpSendSchema.safeParse({ destination: "+919876543210", channel: "sms" }).success).toBe(true);
    });

    it("validates 6-digit OTP verification code", () => {
      expect(otpVerifySchema.safeParse({ challenge_id: "chal_1", code: "123456" }).success).toBe(true);
      expect(otpVerifySchema.safeParse({ challenge_id: "chal_1", code: "12345" }).success).toBe(false);
      expect(otpVerifySchema.safeParse({ challenge_id: "chal_1", code: "abcdef" }).success).toBe(false);
    });
  });

  describe("profileSchema", () => {
    it("validates profile updates", () => {
      expect(profileSchema.safeParse({ first_name: "Sneaker", last_name: "Head" }).success).toBe(true);
      expect(profileSchema.safeParse({ first_name: "", last_name: "Head" }).success).toBe(false);
    });
  });

  describe("password reset schemas", () => {
    it("validates forgotPassword and resetPassword inputs", () => {
      expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
      expect(forgotPasswordSchema.safeParse({ email: "bad-email" }).success).toBe(false);
      expect(resetPasswordSchema.safeParse({ token: "tok_123", password: "validPassword123" }).success).toBe(true);
      expect(resetPasswordSchema.safeParse({ token: "", password: "validPassword123" }).success).toBe(false);
    });
  });
});
