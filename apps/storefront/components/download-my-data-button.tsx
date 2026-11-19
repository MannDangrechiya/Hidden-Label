"use client";

import { Button } from "@thl/ui";
import { useState, useTransition } from "react";
import { exportMyDataAction } from "@/app/actions/account";

/**
 * GAP-REG-03: the export is assembled server-side from the signed-in customer's own records and
 * handed to the browser as a file. Nothing is written to a shared or public location.
 */
export function DownloadMyDataButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function download() {
    setError(null);
    startTransition(async () => {
      try {
        const { filename, json } = await exportMyDataAction();
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      } catch {
        setError("Could not prepare your data. Please try again.");
      }
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Button variant="secondary" onClick={download} loading={pending}>
        Download my data
      </Button>
      {error ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
