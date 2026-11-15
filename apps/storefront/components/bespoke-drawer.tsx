"use client";

import { Button, Drawer } from "@thl/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addToCart } from "@/app/actions/cart";

export type FitPreference = "slim" | "regular" | "relaxed";

export interface BespokeDrawerProps {
  open: boolean;
  onClose: () => void;
  variantId: string | null;
  sizeLabel: string;
  productHandle: string;
  productTitle: string;
}

interface Measurements {
  chest: string;
  waist: string;
  shoulder: string;
  arm: string;
  inseam: string;
}

const EMPTY: Measurements = { chest: "", waist: "", shoulder: "", arm: "", inseam: "" };

const FIELDS: { key: keyof Measurements; label: string; hint: string; min: number; max: number }[] = [
  { key: "chest", label: "Chest", hint: "Fullest point, measured around the body", min: 26, max: 64 },
  { key: "waist", label: "Waist", hint: "Natural waist, not the trouser line", min: 22, max: 64 },
  { key: "shoulder", label: "Shoulder", hint: "Seam to seam across the back", min: 12, max: 26 },
  { key: "arm", label: "Arm length", hint: "Shoulder point to wrist", min: 18, max: 40 },
  { key: "inseam", label: "Trouser inseam", hint: "Crotch to hem", min: 22, max: 40 },
];

const FIT_OPTIONS: { key: FitPreference; label: string; description: string }[] = [
  { key: "slim", label: "Slim", description: "Close to the body, tapered through the waist." },
  { key: "regular", label: "Regular", description: "The house block — clean drape, room to move." },
  { key: "relaxed", label: "Relaxed / Oversized", description: "Dropped shoulder, generous body." },
];

/**
 * Made-to-measure drawer for apparel PDPs.
 *
 * Measurements are inches, entered by the client and stored as numbers. They travel onto the
 * cart line item as `metadata.custom_measurements` (the architecture blueprint's schema) and are
 * read back by the admin tailor sheet — this drawer never claims a fit it cannot deliver.
 */
export function BespokeDrawer({
  open,
  onClose,
  variantId,
  sizeLabel,
  productHandle,
  productTitle,
}: BespokeDrawerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fit, setFit] = useState<FitPreference>("regular");
  const [values, setValues] = useState<Measurements>(EMPTY);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Measurements, string>>>({});

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    setFieldErrors({});
  }, [open]);

  function validate(): { ok: boolean; parsed: Partial<Record<keyof Measurements, number>> } {
    const errors: Partial<Record<keyof Measurements, string>> = {};
    const parsed: Partial<Record<keyof Measurements, number>> = {};

    for (const field of FIELDS) {
      const raw = values[field.key].trim();
      if (raw === "") continue; // every field except chest/waist is optional
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        errors[field.key] = "Enter a number in inches.";
        continue;
      }
      if (numeric < field.min || numeric > field.max) {
        errors[field.key] = `Enter between ${field.min} and ${field.max} inches.`;
        continue;
      }
      parsed[field.key] = numeric;
    }

    if (parsed.chest === undefined) errors.chest = "Chest is required for a made-to-measure order.";
    if (parsed.waist === undefined) errors.waist = "Waist is required for a made-to-measure order.";

    setFieldErrors(errors);
    return { ok: Object.keys(errors).length === 0, parsed };
  }

  function submit() {
    if (!variantId) {
      setMessage("Choose a size first — it anchors the base block the tailor adjusts.");
      return;
    }

    const { ok, parsed } = validate();
    if (!ok) return;

    setMessage(null);
    startTransition(async () => {
      const result = await addToCart(variantId, 1, {
        is_custom: true,
        garment_type: productHandle,
        custom_measurements: {
          chest_inches: parsed.chest,
          waist_inches: parsed.waist,
          shoulder_inches: parsed.shoulder ?? null,
          sleeve_inches: parsed.arm ?? null,
          inseam_inches: parsed.inseam ?? null,
          fit_preference: fit,
          notes: notes.trim() || null,
          product_title: productTitle,
          base_size: sizeLabel,
        },
      });

      if (result.ok) {
        // push() already re-fetches the bag server-side; refreshing the PDP first only added a
        // second render pass the customer could see.
        router.push("/cart");
      } else {
        setMessage(result.message ?? "Could not add the made-to-measure piece to your bag.");
      }
    });
  }

  return (
    <Drawer open={open} onClose={onClose} title="Custom made-to-measure">
      <div className="flex flex-col gap-sp-4">
        <p className="font-sans text-body-sm text-on-surface-variant">
          Every measurement is in inches. The master tailor reviews your sheet at the Sindhu Bhavan
          Road atelier before cutting — if anything looks off, we call you before the fabric is cut.
        </p>

        <div className="border border-line bg-surface-container/40 px-3 py-2 font-mono text-label-caps uppercase text-muted">
          Base block · {productTitle} · {sizeLabel}
        </div>

        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 font-mono text-label-caps uppercase text-on-surface-variant">
            Fit preference
          </legend>
          {FIT_OPTIONS.map((option) => (
            <label
              key={option.key}
              className={[
                "flex cursor-pointer items-start gap-3 border px-3 py-3",
                fit === option.key ? "border-ink bg-surface-container/40" : "border-line",
              ].join(" ")}
            >
              <input
                type="radio"
                name="fit_preference"
                value={option.key}
                checked={fit === option.key}
                onChange={() => setFit(option.key)}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="font-sans text-body-md text-ink">{option.label}</span>
                <span className="font-sans text-body-sm text-muted">{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-sp-3 border-0 p-0">
          <legend className="mb-1 font-mono text-label-caps uppercase text-on-surface-variant">
            Measurements (inches)
          </legend>
          {FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-label-caps uppercase text-ink">
                  {field.label}
                  {field.key === "chest" || field.key === "waist" ? " *" : ""}
                </span>
                <span className="font-sans text-body-sm text-muted">{field.hint}</span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.25"
                min={field.min}
                max={field.max}
                value={values[field.key]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
                aria-invalid={Boolean(fieldErrors[field.key])}
                placeholder={`${field.min}–${field.max}`}
                className="h-12 border border-line bg-surface px-3 font-mono text-body-md tabular text-ink outline-none focus:border-ink"
              />
              {fieldErrors[field.key] ? (
                <span className="font-sans text-body-sm text-error">{fieldErrors[field.key]}</span>
              ) : null}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-label-caps uppercase text-on-surface-variant">
            Monogram / special instructions
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={280}
            placeholder="Monogram initials, contrast stitching, lapel width, delivery date you need it by…"
            className="border border-line bg-surface px-3 py-2 font-sans text-body-sm text-ink outline-none focus:border-ink"
          />
        </label>

        {message ? (
          <p role="alert" className="border border-error bg-error-container px-3 py-2 font-sans text-body-sm text-error">
            {message}
          </p>
        ) : null}

        <Button type="button" onClick={submit} loading={pending} className="w-full">
          Add made-to-measure to bag
        </Button>
        <p className="font-sans text-body-sm text-muted">
          Made-to-measure pieces are cut to order and cannot be returned for fit once cutting has
          started. Alterations at the boutique are included for 14 days after collection.
        </p>
      </div>
    </Drawer>
  );
}
