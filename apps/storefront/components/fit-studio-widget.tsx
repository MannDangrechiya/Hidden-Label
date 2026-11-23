"use client";

import { useState } from "react";
import { requestFitRecommendation, type FitRecommendation } from "@/lib/resale";

interface FitStudioWidgetProps {
  productTitle: string;
  productHandle: string;
  onApplySize?: (sizeLabel: string) => void;
}

export function FitStudioWidget({
  productTitle,
  productHandle,
  onApplySize,
}: FitStudioWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [footLengthCm, setFootLengthCm] = useState(26.5);
  const [footWidth, setFootWidth] = useState<"narrow" | "regular" | "wide">("regular");
  const [isLoading, setIsLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<FitRecommendation | null>(null);

  const handleCalculate = async () => {
    setIsLoading(true);
    const result = await requestFitRecommendation({
      foot_length_cm: footLengthCm,
      foot_width: footWidth,
      product_handle: productHandle,
      silhouette_name: productTitle,
    });
    setIsLoading(false);
    if (result) {
      setRecommendation(result);
    }
  };

  return (
    <div className="border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase text-ink font-semibold">
            Fit Studio
          </span>
          <span className="font-mono text-[10px] text-muted border border-line px-1.5 py-0.2">
            Metric Sizing
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !isOpen;
            setIsOpen(next);
            if (next && !recommendation) {
              handleCalculate();
            }
          }}
          className="font-mono text-xs uppercase underline text-ink hover:text-muted"
        >
          {isOpen ? "Close Guide" : "Find My Size →"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4 border-t border-line pt-3">
          {/* Foot Length in CM */}
          <div>
            <div className="flex justify-between font-mono text-xs text-muted mb-1">
              <span>Foot Length:</span>
              <span className="font-semibold text-ink">{footLengthCm} cm</span>
            </div>
            <input
              type="range"
              min="22.0"
              max="31.0"
              step="0.5"
              value={footLengthCm}
              onChange={(e) => setFootLengthCm(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
            <div className="flex justify-between font-mono text-[10px] text-muted mt-0.5">
              <span>22.0 cm (UK 3)</span>
              <span>26.5 cm (UK 7.5)</span>
              <span>31.0 cm (UK 12)</span>
            </div>
          </div>

          {/* Foot Width */}
          <div>
            <span className="block font-mono text-xs text-muted mb-1.5">Foot Width:</span>
            <div className="grid grid-cols-3 gap-2">
              {(["narrow", "regular", "wide"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setFootWidth(w)}
                  className={`py-1.5 font-mono text-xs uppercase border transition-colors ${
                    footWidth === w
                      ? "border-ink bg-ink text-surface"
                      : "border-line text-muted hover:border-ink hover:text-ink"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            disabled={isLoading}
            className="w-full border border-line bg-surface-container py-2 font-mono text-xs uppercase text-ink hover:border-ink transition-colors"
          >
            {isLoading ? "Analyzing Silhouette Geometry..." : "Recalculate Recommendation"}
          </button>

          {/* Results Display */}
          {recommendation && (
            <div className="border border-emerald-400 bg-emerald-50/50 p-3 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs text-emerald-900 uppercase">
                  Optimal Silhouette Size:
                </span>
                <span className="font-mono text-base font-bold text-emerald-900">
                  {recommendation.recommended_size}
                </span>
              </div>
              <p className="font-sans text-xs text-emerald-800 leading-relaxed">
                {recommendation.guidance}
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-emerald-200 text-[11px] font-mono text-emerald-700">
                <span>Baseline: UK {recommendation.baseline_uk_size.toFixed(1)}</span>
                <span>Delta: {recommendation.total_delta >= 0 ? `+${recommendation.total_delta}` : recommendation.total_delta}</span>
                <span>Match: {Math.round(recommendation.confidence_score * 100)}%</span>
              </div>
              {onApplySize && (
                <button
                  type="button"
                  onClick={() => onApplySize(recommendation.recommended_size)}
                  className="w-full mt-2 border border-emerald-700 bg-emerald-700 py-1.5 font-mono text-xs uppercase text-surface hover:bg-emerald-800"
                >
                  Select {recommendation.recommended_size}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
