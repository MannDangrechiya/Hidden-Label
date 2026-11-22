"use client";

import { useState } from "react";
import type { AdminResaleAsk } from "../../../lib/api/resale";
import {
  publishResaleAskAction,
  settleResaleAskAction,
  updateResaleAskStatusAction,
} from "./actions";

export function ResaleAsksTable({
  initialAsks,
  canWrite,
}: {
  initialAsks: AdminResaleAsk[];
  canWrite: boolean;
}) {
  const [asks, setAsks] = useState<AdminResaleAsk[]>(initialAsks);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleMarkAuthenticated = async (id: string) => {
    setPendingId(id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await updateResaleAskStatusAction(id, "authenticated");
      if (res.success) {
        setAsks((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "authenticated" } : a)),
        );
        setSuccessMessage(`Ask ${id} marked authenticated.`);
      } else {
        setErrorMessage(res.error ?? "Failed to update status.");
      }
    } catch {
      setErrorMessage("Network error updating ask.");
    } finally {
      setPendingId(null);
    }
  };

  const handlePublishInventory = async (id: string) => {
    setPendingId(id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await publishResaleAskAction(id);
      if (res.success) {
        setAsks((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "active" } : a)),
        );
        setSuccessMessage(`Ask ${id} successfully published to catalog inventory.`);
      } else {
        setErrorMessage(res.error ?? "Failed to publish inventory.");
      }
    } catch {
      setErrorMessage("Network error publishing inventory.");
    } finally {
      setPendingId(null);
    }
  };

  const handleSettlePayout = async (id: string, askPrice: number | string) => {
    const ref = window.prompt("Enter NEFT/UPI Payout Reference (or leave blank for pending):", "NEFT-SETTLE");
    if (ref === null) return;

    setPendingId(id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await settleResaleAskAction(id, Number(askPrice), 0.10, ref || undefined);
      if (res.success) {
        setAsks((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "settled" } : a)),
        );
        setSuccessMessage(`Consignor settlement logged for Ask ${id}.`);
      } else {
        setErrorMessage(res.error ?? "Failed to settle payout.");
      }
    } catch {
      setErrorMessage("Network error processing settlement.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {errorMessage && (
        <div className="border border-red-500/30 bg-red-500/10 p-2 font-mono text-xs text-red-700">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 p-2 font-mono text-xs text-emerald-800">
          {successMessage}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-xs">
          <thead className="border-b border-line bg-surface-container/40 font-mono text-[10px] uppercase text-muted">
            <tr>
              <th className="p-2">Product &amp; Size</th>
              <th className="p-2">Ask (INR)</th>
              <th className="p-2">Grade</th>
              <th className="p-2">Status</th>
              <th className="p-2">Seller</th>
              {canWrite && <th className="p-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {asks.slice(0, 25).map((ask) => {
              const isPending = pendingId === ask.id;
              return (
                <tr key={ask.id} className="hover:bg-surface-container/20">
                  <td className="p-2">
                    <span className="font-medium text-ink block truncate max-w-[180px]">
                      {ask.product_title}
                    </span>
                    <span className="font-mono text-[10px] text-muted">{ask.variant_title}</span>
                  </td>
                  <td className="p-2 font-mono font-semibold text-emerald-800">
                    ₹{Number(ask.ask_price).toLocaleString("en-IN")}
                  </td>
                  <td className="p-2 font-mono text-[11px]">{ask.condition_grade}</td>
                  <td className="p-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 font-mono text-[10px] uppercase rounded ${
                        ask.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                          : ask.status === "authenticated"
                          ? "bg-blue-50 text-blue-700 border border-blue-300"
                          : ask.status === "sold"
                          ? "bg-purple-50 text-purple-700 border border-purple-300"
                          : ask.status === "settled"
                          ? "bg-stone-100 text-stone-700 border border-stone-300"
                          : "bg-surface-container text-muted"
                      }`}
                    >
                      {ask.status}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-[10px] text-muted truncate max-w-[120px]">
                    {ask.seller_email}
                  </td>
                  {canWrite && (
                    <td className="p-2 text-right">
                      {ask.status === "intake_received" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleMarkAuthenticated(ask.id)}
                          className="px-2 py-0.5 font-mono text-[10px] uppercase border border-ink bg-surface hover:bg-ink hover:text-white disabled:opacity-50 transition-colors"
                        >
                          {isPending ? "..." : "Authenticate"}
                        </button>
                      )}
                      {ask.status === "authenticated" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handlePublishInventory(ask.id)}
                          className="px-2 py-0.5 font-mono text-[10px] uppercase border border-blue-600 bg-blue-50 text-blue-800 hover:bg-blue-600 hover:text-white disabled:opacity-50 transition-colors"
                        >
                          {isPending ? "..." : "Publish Inv."}
                        </button>
                      )}
                      {ask.status === "sold" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSettlePayout(ask.id, ask.ask_price)}
                          className="px-2 py-0.5 font-mono text-[10px] uppercase border border-purple-600 bg-purple-50 text-purple-800 hover:bg-purple-600 hover:text-white disabled:opacity-50 transition-colors"
                        >
                          {isPending ? "..." : "Settle"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
