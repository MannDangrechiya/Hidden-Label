"use client";

import { useRef, useState } from "react";
import { lookupPincodeAction } from "@/app/actions/pincode";

interface InitialPincode {
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
}

/**
 * ADR-01: shared PIN → city/state autofill for the address book and checkout forms.
 *
 * Stale responses are dropped with a request counter, so typing 380001 then replacing it with
 * 400001 never leaves Ahmedabad in the city field.
 */
export function usePincodeLookup(initial: InitialPincode) {
  const [pin, setPin] = useState(initial.postal_code ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [province, setProvince] = useState(initial.province ?? "");
  const [error, setError] = useState<string | undefined>();
  const [looking, setLooking] = useState(false);
  const latest = useRef(0);

  async function changePin(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setPin(digits);
    setError(undefined);
    if (digits.length !== 6) {
      latest.current += 1;
      setLooking(false);
      return;
    }

    const request = ++latest.current;
    setLooking(true);
    try {
      const result = await lookupPincodeAction(digits);
      if (request !== latest.current) return;
      if (result.ok) {
        setCity(result.city);
        setProvince(result.state);
      } else {
        setError(result.message);
      }
    } finally {
      if (request === latest.current) setLooking(false);
    }
  }

  return {
    pin,
    city,
    province,
    error,
    looking,
    changePin,
    setCity,
    setProvince,
    clearError: () => setError(undefined),
  };
}
