"use client";

import { useState } from "react";
import type { SupportTicket } from "../../../lib/api/support";
import { updateSupportTicketAction } from "./actions";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress", "awaiting_customer", "resolved"],
  in_progress: ["awaiting_customer", "resolved"],
  awaiting_customer: ["in_progress", "resolved"],
  resolved: ["closed"],
  closed: [],
};

export function SupportTicketList({
  initialTickets,
  canWrite,
}: {
  initialTickets: SupportTicket[];
  canWrite: boolean;
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdate = async (id: string, newStatus: string, resolution?: string) => {
    setPendingId(id);
    setErrorMsg(null);
    try {
      const res = await updateSupportTicketAction(id, {
        status: newStatus,
        resolution,
      });
      if (res.success) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: newStatus,
                  resolution: resolution ?? t.resolution,
                  resolved_at: newStatus === "resolved" ? new Date().toISOString() : t.resolved_at,
                }
              : t,
          ),
        );
      } else {
        setErrorMsg(res.error ?? "Failed to update ticket.");
      }
    } catch {
      setErrorMsg("Network error updating ticket.");
    } finally {
      setPendingId(null);
    }
  };

  const promptResolution = (id: string) => {
    const text = window.prompt("Enter ticket resolution summary (required for statutory compliance):");
    if (!text || !text.trim()) return;
    handleUpdate(id, "resolved", text.trim());
  };

  return (
    <div className="flex flex-col gap-3">
      {errorMsg && (
        <div className="border border-red-500/30 bg-red-500/10 p-2 font-mono text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {tickets.map((ticket) => {
          const isPending = pendingId === ticket.id;
          const transitions = STATUS_TRANSITIONS[ticket.status] ?? [];

          return (
            <li key={ticket.id} className="border border-line bg-surface p-sp-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-body-sm font-semibold uppercase text-ink">
                    {ticket.display_id}
                  </span>
                  <span className="border border-line px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
                    {ticket.category}
                  </span>
                  <span
                    className={[
                      "px-2 py-0.5 font-mono text-[10px] uppercase",
                      ticket.priority === "high"
                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                        : "bg-surface-container text-ink",
                    ].join(" ")}
                  >
                    {ticket.priority}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 font-mono text-[10px] uppercase rounded border ${
                      ticket.status === "open"
                        ? "bg-amber-50 text-amber-800 border-amber-300"
                        : ticket.status === "in_progress"
                        ? "bg-blue-50 text-blue-800 border-blue-300"
                        : ticket.status === "resolved"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-stone-100 text-stone-700 border-stone-300"
                    }`}
                  >
                    {ticket.status.replace(/_/g, " ")}
                  </span>

                  {canWrite && transitions.length > 0 && (
                    <div className="flex items-center gap-1.5 ml-2">
                      {transitions.includes("in_progress") && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdate(ticket.id, "in_progress")}
                          className="px-2 py-0.5 font-mono text-[10px] uppercase border border-line bg-surface hover:border-ink disabled:opacity-40"
                        >
                          {isPending ? "..." : "In Progress"}
                        </button>
                      )}
                      {transitions.includes("awaiting_customer") && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdate(ticket.id, "awaiting_customer")}
                          className="px-2 py-0.5 font-mono text-[10px] uppercase border border-line bg-surface hover:border-ink disabled:opacity-40"
                        >
                          {isPending ? "..." : "Await Client"}
                        </button>
                      )}
                      {transitions.includes("resolved") && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => promptResolution(ticket.id)}
                          className="px-2 py-0.5 font-mono text-[10px] uppercase border border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white disabled:opacity-40"
                        >
                          {isPending ? "..." : "Resolve"}
                        </button>
                      )}
                      {transitions.includes("closed") && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleUpdate(ticket.id, "closed")}
                          className="px-2 py-0.5 font-mono text-[10px] uppercase border border-line bg-surface text-stone-600 hover:border-stone-800 disabled:opacity-40"
                        >
                          {isPending ? "..." : "Close"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <h2 className="mt-2 font-display text-headline-sm uppercase">{ticket.subject}</h2>
              <p className="mt-1 whitespace-pre-line font-sans text-body-sm text-on-surface-variant">
                {ticket.message}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-2 font-mono text-[11px] uppercase text-muted">
                <span>{ticket.name}</span>
                <a href={`mailto:${ticket.email}`} className="underline">
                  {ticket.email}
                </a>
                {ticket.phone ? <span>{ticket.phone}</span> : null}
                {ticket.order_id ? <span>Order {ticket.order_id}</span> : null}
                <span>{new Date(ticket.created_at).toLocaleString("en-IN")}</span>
              </div>

              {ticket.resolution && (
                <div className="mt-2 border-l-2 border-emerald-600 bg-emerald-50/50 p-2 font-sans text-body-sm text-emerald-950">
                  <span className="font-mono text-label-caps uppercase text-emerald-800 block text-[10px]">
                    Statutory Resolution
                  </span>
                  {ticket.resolution}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
