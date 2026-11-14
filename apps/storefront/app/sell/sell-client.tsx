"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { placeResaleAsk } from "@/lib/resale";
import type { StoreProduct } from "@/lib/medusa";

interface SellClientProps {
  products: StoreProduct[];
  initialProductHandle?: string;
  initialSize?: string;
  isLoggedIn: boolean;
  token: string | null;
}

export function SellClient({
  products,
  initialProductHandle,
  initialSize,
  isLoggedIn,
  token,
}: SellClientProps) {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    if (initialProductHandle) {
      const match = products.find((p) => p.handle === initialProductHandle);
      if (match) return match.id;
    }
    return products[0]?.id ?? "";
  });

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? products[0],
    [products, selectedProductId],
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => {
    if (!selectedProduct) return "";
    if (initialSize) {
      const match = selectedProduct.variants?.find((v) =>
        v.title?.toLowerCase().includes(initialSize.toLowerCase()),
      );
      if (match) return match.id;
    }
    return selectedProduct.variants?.[0]?.id ?? "";
  });

  const [conditionGrade, setConditionGrade] = useState("deadstock");
  const [boxCondition, setBoxCondition] = useState("perfect");
  const [askPriceStr, setAskPriceStr] = useState("18500");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successAsk, setSuccessAsk] = useState<Record<string, unknown> | null>(null);

  // Filtered product suggestions
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const askPriceNum = Number(askPriceStr) || 0;
  const platformFee = Math.round(askPriceNum * 0.095); // 9.5% consignment fee
  const sellerPayout = Math.max(0, askPriceNum - platformFee);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isLoggedIn || !token) {
      router.push(`/login?redirect=/sell?product=${selectedProduct?.handle}`);
      return;
    }

    if (!selectedVariantId) {
      setErrorMsg("Please select a shoe size.");
      return;
    }

    if (askPriceNum <= 0) {
      setErrorMsg("Please enter a valid asking price greater than 0.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await placeResaleAsk(
        selectedVariantId,
        askPriceNum,
        conditionGrade,
        boxCondition,
        token,
      );
      if (!res.success) {
        setErrorMsg(res.error || "Failed to list item.");
      } else {
        setSuccessAsk((res.ask as Record<string, unknown>) ?? {});
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to list item.");
    } finally {
      setSubmitting(false);
    }
  };

  if (successAsk) {
    return (
      <div className="max-w-xl mx-auto border border-emerald-500/30 bg-surface p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          ✓
        </div>
        <div>
          <span className="font-mono text-xs uppercase text-emerald-600 font-bold tracking-widest">
            Listing Live in Orderbook
          </span>
          <h2 className="font-display text-headline-md uppercase text-ink mt-1">
            Pair Successfully Consigned
          </h2>
          <p className="font-sans text-xs text-muted mt-2 max-w-sm mx-auto">
            Your asking price of{" "}
            <strong className="text-ink font-mono font-bold">
              {formatINR(moneyFromRupees(askPriceNum))}
            </strong>{" "}
            is now visible to all active buyers. We will notify you via SMS/Email the moment a buyer matches your ask.
          </p>
        </div>

        <div className="border border-line bg-surface-container/20 p-4 text-left font-sans text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-muted">Item:</span>
            <span className="font-medium text-ink">{selectedProduct?.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Condition:</span>
            <span className="font-mono uppercase text-ink">{conditionGrade} ({boxCondition} box)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Estimated Payout:</span>
            <span className="font-mono font-bold text-emerald-600">{formatINR(moneyFromRupees(sellerPayout))}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/account/asks"
            className="flex-1 border border-ink bg-ink px-4 py-3 font-mono text-xs uppercase text-surface text-center hover:bg-ink/90 transition-colors"
          >
            View in My Consignments →
          </Link>
          <button
            type="button"
            onClick={() => {
              setSuccessAsk(null);
              setAskPriceStr("18500");
            }}
            className="flex-1 border border-line bg-surface px-4 py-3 font-mono text-xs uppercase text-ink text-center hover:bg-surface-container/40 transition-colors"
          >
            List Another Pair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12 max-w-5xl mx-auto">
      {/* Left Column: Model & Size Selector */}
      <div className="lg:col-span-7 space-y-8">
        {/* Step 1: Search & Choose Product */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase text-ink font-bold tracking-wider">
              1. Select Sneaker Model
            </h2>
            <span className="font-mono text-[10px] text-muted">
              {products.length} models available
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search by name (e.g. Jordan 1, Samba, Dunk, XT-6)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-line bg-surface px-4 py-3 font-sans text-xs text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[340px] overflow-y-auto p-1 border border-line bg-surface-container/10">
            {filteredProducts.map((p) => {
              const isSelected = p.id === selectedProductId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProductId(p.id);
                    setSelectedVariantId(p.variants?.[0]?.id ?? "");
                  }}
                  className={`text-left p-3 border transition-all flex flex-col justify-between ${
                    isSelected
                      ? "border-ink bg-surface shadow-sm ring-1 ring-ink"
                      : "border-line/60 bg-surface hover:border-line"
                  }`}
                >
                  <div className="relative aspect-square w-full mb-2 bg-surface-container/30 overflow-hidden">
                    {p.thumbnail ? (
                      <Image
                        src={p.thumbnail}
                        alt={p.title}
                        fill
                        className="object-contain p-2"
                        sizes="160px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-muted">
                        No photo
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-muted block uppercase truncate">
                      {p.collection?.title ?? "Sneakers"}
                    </span>
                    <span className="font-sans text-xs font-medium text-ink block line-clamp-2 leading-tight">
                      {p.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Choose Size */}
        {selectedProduct && (
          <div className="space-y-4 pt-4 border-t border-line">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase text-ink font-bold tracking-wider">
                2. Select Size (UK)
              </h2>
              <span className="font-mono text-[10px] text-muted">
                {selectedProduct.variants?.length ?? 0} sizes available
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {selectedProduct.variants?.map((v) => {
                const isSelected = v.id === selectedVariantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`py-3 px-2 border font-mono text-xs uppercase transition-all ${
                      isSelected
                        ? "border-ink bg-ink text-surface font-bold shadow-sm"
                        : "border-line bg-surface text-ink hover:border-ink/60"
                    }`}
                  >
                    {v.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Condition & Box */}
        <div className="space-y-6 pt-4 border-t border-line">
          <div>
            <h2 className="font-mono text-xs uppercase text-ink font-bold tracking-wider mb-3">
              3. Sneaker Condition
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "deadstock", label: "Deadstock", desc: "Brand New, Unworn" },
                { id: "very_good", label: "Very Good", desc: "Worn 1-2x, Clean" },
                { id: "good", label: "Good", desc: "Light Wear, Flawless" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setConditionGrade(c.id)}
                  className={`p-3 text-left border transition-all ${
                    conditionGrade === c.id
                      ? "border-ink bg-surface-container/30 ring-1 ring-ink"
                      : "border-line bg-surface hover:border-line"
                  }`}
                >
                  <span className="font-mono text-xs uppercase font-bold text-ink block">
                    {c.label}
                  </span>
                  <span className="font-sans text-[10px] text-muted block mt-1">
                    {c.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase text-ink font-bold tracking-wider mb-3">
              Box &amp; Accessories
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "perfect", label: "Original (Mint)", desc: "Original box, crisp" },
                { id: "damaged", label: "Original (Damaged)", desc: "Box has scuffs/dents" },
                { id: "replacement", label: "Replacement", desc: "No original box" },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBoxCondition(b.id)}
                  className={`p-3 text-left border transition-all ${
                    boxCondition === b.id
                      ? "border-ink bg-surface-container/30 ring-1 ring-ink"
                      : "border-line bg-surface hover:border-line"
                  }`}
                >
                  <span className="font-mono text-xs uppercase font-bold text-ink block">
                    {b.label}
                  </span>
                  <span className="font-sans text-[10px] text-muted block mt-1">
                    {b.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Pricing & Consignment Summary Card */}
      <div className="lg:col-span-5">
        <div className="sticky top-24 border border-ink bg-surface p-6 shadow-sm space-y-6">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted block">
              Consignment Orderbook Listing
            </span>
            <h3 className="font-display text-headline-sm uppercase text-ink mt-1">
              {selectedProduct?.title ?? "Select Sneaker"}
            </h3>
          </div>

          {/* Ask Price Input */}
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase text-ink block font-bold">
              Set Your Asking Price (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-base font-bold text-ink">
                ₹
              </span>
              <input
                type="number"
                min="1000"
                step="500"
                value={askPriceStr}
                onChange={(e) => setAskPriceStr(e.target.value)}
                className="w-full border border-ink bg-surface pl-8 pr-4 py-3 font-mono text-lg font-bold text-ink focus:outline-none"
              />
            </div>
            <p className="font-sans text-[11px] text-muted">
              Buyers can buy instantly at this price or place bids. You can update or cancel anytime.
            </p>
          </div>

          {/* Fee & Payout Breakdown */}
          <div className="border-t border-b border-line py-4 space-y-2 font-sans text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Listing Price:</span>
              <span className="font-mono font-medium text-ink">
                {formatINR(moneyFromRupees(askPriceNum))}
              </span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Platform &amp; Authentication Fee (9.5%):</span>
              <span className="font-mono">- {formatINR(moneyFromRupees(platformFee))}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>In-Lab Authentication:</span>
              <span className="font-mono text-emerald-600 uppercase font-bold">Free</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Domestic Insured Shipping:</span>
              <span className="font-mono text-emerald-600 uppercase font-bold">Free</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-line font-mono text-sm font-bold text-ink">
              <span>Your Estimated Payout:</span>
              <span className="text-emerald-600 text-base">
                {formatINR(moneyFromRupees(sellerPayout))}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="border border-rose-500/40 bg-rose-500/10 p-3 font-sans text-xs text-rose-600">
              {errorMsg}
            </div>
          )}

          {/* Submit Action */}
          <form onSubmit={handleSubmit}>
            <button
              type="submit"
              disabled={submitting}
              className="w-full border border-ink bg-ink py-4 font-mono text-xs uppercase tracking-wider text-surface font-bold hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {submitting
                ? "Submitting Listing..."
                : isLoggedIn
                ? `List for Sale — ${formatINR(moneyFromRupees(askPriceNum))}`
                : "Sign In to List for Sale"}
            </button>
          </form>

          {/* Trust Guarantees */}
          <div className="space-y-2 pt-2">
            <div className="flex items-start gap-2 text-[11px] text-muted">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>0 Upfront Fees:</strong> You only pay the consignment fee once your pair sells.</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-muted">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Lab Verification:</strong> Ship to our authentication hub with prepaid insured courier.</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-muted">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Bank Transfer:</strong> Payout sent to your bank account once your listing clears inspection and sells.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
