"use client";

import { useState } from "react";
import Link from "next/link";
import type { InspectionCertificate } from "@/lib/resale";

interface InspectionViewerProps {
  inspection: InspectionCertificate;
  compact?: boolean;
}

export function InspectionViewer({ inspection, compact = false }: InspectionViewerProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [activePhotoTab, setActivePhotoTab] = useState<"turntable" | "macro">("turntable");
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const frames = inspection.turntable_media && inspection.turntable_media.length > 0
    ? inspection.turntable_media
    : [inspection.product.thumbnail || ""];

  const detailPhotos = inspection.detail_photos || [];

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    if (Math.abs(diff) > 25) {
      const step = diff > 0 ? 1 : -1;
      setCurrentFrame((prev) => (prev + step + frames.length) % frames.length);
      setStartX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const checklistKeys = Object.keys(inspection.checklist || {});

  return (
    <div className="border border-line bg-surface p-5 sm:p-6">
      {/* Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-surface text-[10px] font-mono">
              ✓
            </span>
            <span className="font-mono text-label-caps uppercase tracking-wider text-ink font-semibold">
              Authenticated &amp; Graded Unit
            </span>
          </div>
          <span className="mt-1 block font-mono text-[11px] text-muted">
            Serial: {inspection.unit_serial} · Box: {inspection.box_condition}
          </span>
        </div>
        <div className="text-right">
          <span className="inline-block border border-emerald-600 bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-800 uppercase">
            {inspection.condition_grade}
          </span>
        </div>
      </div>

      {/* Viewer Toggle Tabs */}
      <div className="my-3 flex gap-2 border-b border-line pb-2">
        <button
          type="button"
          onClick={() => setActivePhotoTab("turntable")}
          className={`font-mono text-xs uppercase px-3 py-1 border transition-colors ${
            activePhotoTab === "turntable"
              ? "border-ink bg-ink text-surface"
              : "border-line text-muted hover:text-ink"
          }`}
        >
          360° Turntable ({frames.length} Angles)
        </button>
        <button
          type="button"
          onClick={() => setActivePhotoTab("macro")}
          className={`font-mono text-xs uppercase px-3 py-1 border transition-colors ${
            activePhotoTab === "macro"
              ? "border-ink bg-ink text-surface"
              : "border-line text-muted hover:text-ink"
          }`}
        >
          Macro Close-ups ({detailPhotos.length})
        </button>
      </div>

      {/* Main Display Area */}
      {activePhotoTab === "turntable" ? (
        <div className="flex flex-col items-center">
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative aspect-square w-full max-w-sm cursor-grab active:cursor-grabbing overflow-hidden border border-line bg-surface-container select-none"
          >
            <img
              src={frames[currentFrame]}
              alt={`Angle ${currentFrame + 1} of 360 inspection`}
              className="h-full w-full object-contain pointer-events-none"
            />
            <div className="absolute bottom-2 right-2 rounded bg-ink/80 px-2 py-0.5 font-mono text-[10px] text-surface">
              Angle {currentFrame * 45}° ({currentFrame + 1}/{frames.length})
            </div>
            <div className="absolute top-2 left-2 rounded bg-surface/90 border border-line px-2 py-0.5 font-mono text-[10px] text-muted">
              Drag left / right to spin
            </div>
          </div>

          {/* Scrub Slider */}
          <div className="mt-3 w-full max-w-sm flex items-center gap-3">
            <span className="font-mono text-[10px] text-muted">0°</span>
            <input
              type="range"
              min="0"
              max={frames.length - 1}
              value={currentFrame}
              onChange={(e) => setCurrentFrame(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
            <span className="font-mono text-[10px] text-muted">360°</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {detailPhotos.map((photo, i) => (
            <div key={i} className="border border-line bg-surface-container p-2 text-center">
              <div className="aspect-square w-full overflow-hidden mb-1">
                <img src={photo.url} alt={photo.label} className="h-full w-full object-cover" />
              </div>
              <span className="font-mono text-[10px] text-ink block truncate">{photo.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Verified Inspection Checklist */}
      {!compact && (
        <div className="mt-5 border-t border-line pt-4">
          <h4 className="font-mono text-label-caps uppercase text-muted mb-2">
            Verified Physical Authentication Matrix
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {checklistKeys.map((key) => {
              const val = inspection.checklist[key];
              const label = key.replace(/_/g, " ");
              return (
                <div key={key} className="flex items-center justify-between border border-line p-2 text-xs font-mono">
                  <span className="capitalize text-muted">{label}</span>
                  <span className="font-semibold text-emerald-700">
                    {typeof val === "boolean" ? (val ? "PASS" : "FAIL") : String(val).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>

          {inspection.notes && (
            <div className="mt-3 border border-line bg-surface-container/30 p-2.5">
              <span className="block font-mono text-[10px] uppercase text-muted mb-0.5">Inspector Notes:</span>
              <p className="font-sans text-xs text-on-surface-variant leading-relaxed">
                {inspection.notes}
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs font-mono">
            <span className="text-muted">
              Inspected on {inspection.inspected_at ? new Date(inspection.inspected_at).toLocaleDateString("en-IN") : "Recent"}
            </span>
            <Link
              href={`/verify/${inspection.unit_serial}`}
              className="underline text-ink hover:text-muted"
            >
              Open Permanent Certificate ↗
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
