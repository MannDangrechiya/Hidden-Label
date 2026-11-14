"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleWishlistAction } from "@/app/actions/account";

export function WishlistButton({ variantId, initialSaved }: { variantId: string; initialSaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle() {
    setMessage(null);
    startTransition(async () => {
      const result = await toggleWishlistAction(variantId, saved);
      if (result.ok) {
        setSaved(!saved);
        router.refresh();
      } else {
        setMessage(result.message ?? "Could not update your saved list.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className="inline-flex min-h-12 items-center justify-center gap-2 border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink transition-colors enabled:hover:bg-ink enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saved ? "Saved" : "Save"}
      </button>
      {message ? <p className="font-sans text-body-sm text-error">{message}</p> : null}
    </div>
  );
}
