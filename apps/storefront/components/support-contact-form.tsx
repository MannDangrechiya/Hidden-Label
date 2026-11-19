"use client";

import { Button, Input } from "@thl/ui";
import { useState, useTransition } from "react";
import { submitSupportTicketAction } from "@/app/actions/support";

const CATEGORIES = [
  { value: "general", label: "General question" },
  { value: "order", label: "Order or delivery" },
  { value: "return", label: "Return or exchange" },
  { value: "product", label: "Product or sizing" },
  { value: "payment", label: "Payment or refund" },
  { value: "privacy", label: "Privacy / data request" },
  { value: "grievance", label: "Formal grievance" },
];

export function SupportContactForm({
  defaultEmail = "",
  defaultName = "",
  orderRef = "",
}: {
  defaultEmail?: string;
  defaultName?: string;
  orderRef?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await submitSupportTicketAction(formData);
      setMessage({ text: result.message ?? (result.ok ? "Submitted." : "Could not submit."), ok: result.ok });
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-sp-3" noValidate>
      <div className="grid gap-sp-3 sm:grid-cols-2">
        <Input label="Your name" name="name" defaultValue={defaultName} required />
        <Input label="Email" name="email" type="email" defaultValue={defaultEmail} required />
      </div>
      <div className="grid gap-sp-3 sm:grid-cols-2">
        <Input label="Phone (optional)" name="phone" type="tel" placeholder="9876543210" />
        <Input label="Order number (optional)" name="order_id" placeholder="THL-1234" defaultValue={orderRef} />
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-label-caps uppercase text-muted">Category</span>
        <select
          name="category"
          defaultValue="general"
          className="h-11 border border-line bg-surface px-3 font-sans text-body-md text-ink outline-none focus:border-ink"
        >
          {CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <Input label="Subject" name="subject" required />
      <label className="flex flex-col gap-1">
        <span className="font-mono text-label-caps uppercase text-muted">Message</span>
        <textarea
          name="message"
          required
          rows={6}
          maxLength={5000}
          className="border border-line bg-surface p-3 font-sans text-body-md text-ink outline-none focus:border-ink"
        />
      </label>

      {message ? (
        <p
          role="alert"
          className={[
            "border px-3 py-2 font-sans text-body-sm",
            message.ok ? "border-ink bg-surface-container text-ink" : "border-error bg-error-container text-error",
          ].join(" ")}
        >
          {message.text}
        </p>
      ) : null}

      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Submitting…" : "Submit request"}
      </Button>

      <p className="font-sans text-body-sm text-muted">
        Acknowledged within 48 hours, resolved within 30 days. Urgent or statutory complaints can
        also be sent directly to the{" "}
        <a href="/policies/grievance" className="underline">
          Grievance Officer
        </a>
        .
      </p>
    </form>
  );
}
