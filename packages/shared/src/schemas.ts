import { z } from "zod";

/**
 * Validation schemas shared by the storefront's client forms and server actions
 * (agent/RULES.md: "one zod schema in packages/shared, reused by the API route and the
 * client form"). These are intentionally conservative — they only check shape and format;
 * business rules (stock, eligibility, rate limits) are enforced by the backend.
 */

const email = z.string().trim().min(1, "Email is required.").email("Enter a valid email address.");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

export const registerSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required."),
  last_name: z.string().trim().min(1, "Last name is required."),
  email,
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format, for example +919876543210.")
    .optional()
    .or(z.literal("")),
  password,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is missing."),
  password,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const otpSendSchema = z.object({
  destination: z.string().trim().min(3, "Enter a destination."),
  channel: z.enum(["email", "sms"]),
  purpose: z.string().min(1).default("email_verify"),
});
export type OtpSendInput = z.infer<typeof otpSendSchema>;

export const otpVerifySchema = z.object({
  challenge_id: z.string().min(1, "Missing verification challenge."),
  code: z.string().regex(/^\d{6}$/, "Enter the six-digit code."),
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const addressSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required."),
  last_name: z.string().trim().min(1, "Last name is required."),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format, for example +919876543210."),
  address_1: z.string().trim().min(1, "Address line 1 is required."),
  address_2: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required."),
  province: z.string().trim().min(1, "State is required."),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a 6-digit PIN code."),
  country_code: z.string().trim().length(2).default("in"),
  company: z.string().trim().optional().or(z.literal("")),
  is_default_shipping: z.boolean().optional(),
  is_default_billing: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const profileSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required."),
  last_name: z.string().trim().min(1, "Last name is required."),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format, for example +919876543210.")
    .optional()
    .or(z.literal("")),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const returnRequestSchema = z.object({
  order_id: z.string().min(1),
  reason_code: z.enum(["wrong_size", "changed_mind", "damaged", "wrong_item", "other"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        order_item_id: z.string().min(1),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1, "Select at least one item to return."),
});
export type ReturnRequestInput = z.infer<typeof returnRequestSchema>;

export const checkoutContactSchema = z.object({
  email,
});

export type PaymentMethod = "cod" | "razorpay";

export const RETURN_REASONS: { value: ReturnRequestInput["reason_code"]; label: string }[] = [
  { value: "wrong_size", label: "Wrong size" },
  { value: "changed_mind", label: "Changed my mind" },
  { value: "damaged", label: "Arrived damaged" },
  { value: "wrong_item", label: "Wrong item received" },
  { value: "other", label: "Other" },
];
