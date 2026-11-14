"use client";

import { useState } from "react";
import type { AdminInspection } from "../../../lib/api/resale";
import { updateInspectionStatusAction } from "./actions";

export function InspectionTable({
  initialInspections,
  canWrite,
}: {
  initialInspections: AdminInspection[];
  canWrite: boolean;
}) {
  const [inspections, setInspections] = useState(initialInspections);
  const [filter, setFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = inspections.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  const handleUpdateStatus = async (id: string, newStatus: "approved" | "rejected") => {
    setUpdatingId(id);
    try {
      const res = await updateInspectionStatusAction(id, newStatus);
      if (res.success) {
        setInspections((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)),
        );
      }
    } catch {
      // Fallback
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex gap-2 border-b border-line pb-3">
        {["all", "pending", "approved", "rejected"].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilter(st)}
            className={`px-3 py-1 font-mono text-xs uppercase border transition-colors ${
              filter === st
                ? "border-ink bg-ink text-white"
                : "border-line text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {st} ({st === "all" ? inspections.length : inspections.filter((i) => i.status === st).length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-line bg-white">
        <table className="w-full text-left font-sans text-body-sm">
          <thead className="border-b border-line bg-surface-container/50 font-mono text-label-caps uppercase text-muted">
            <tr>
              <th className="p-3">Unit Serial</th>
              <th className="p-3">Product &amp; Size</th>
              <th className="p-3">Grade</th>
              <th className="p-3">Box</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              {canWrite && <th className="p-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center font-mono text-xs text-muted">
                  No inspection units found matching &ldquo;{filter}&rdquo;.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-surface-container/20">
                  <td className="p-3 font-mono text-xs font-semibold text-ink">
                    {item.unit_serial}
                  </td>
                  <td className="p-3">
                    <span className="block font-medium text-ink">{item.product_title}</span>
                    <span className="font-mono text-xs text-muted">
                      {item.variant_title} · SKU: {item.variant_sku ?? "—"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="border border-line bg-surface-container px-2 py-0.5 font-mono text-xs">
                      {item.condition_grade}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs capitalize text-muted">
                    {item.box_condition}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 font-mono text-[11px] uppercase font-semibold ${
                        item.status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "rejected"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted">
                    {new Date(item.created_at).toLocaleDateString("en-IN")}
                  </td>
                  {canWrite && (
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {item.status !== "approved" && (
                          <button
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={() => handleUpdateStatus(item.id, "approved")}
                            className="border border-emerald-600 bg-emerald-600 px-2 py-1 font-mono text-[10px] uppercase text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {item.status !== "rejected" && (
                          <button
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={() => handleUpdateStatus(item.id, "rejected")}
                            className="border border-rose-600 bg-rose-600 px-2 py-1 font-mono text-[10px] uppercase text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
