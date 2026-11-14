import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchInspectionCertificate } from "@/lib/resale";
import { InspectionViewer } from "@/components/inspection-viewer";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ serial: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { serial } = await params;
  return {
    title: `Certificate of Authenticity — ${serial} | The Hidden Label`,
  };
}

export default async function InspectionCertificatePage({ params }: PageProps) {
  const { serial } = await params;
  const inspection = await fetchInspectionCertificate(serial);

  if (!inspection) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
      {/* Top Banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between border-b border-line pb-4">
        <div>
          <span className="font-mono text-label-caps uppercase text-muted">
            The Hidden Label · Physical Authentication Vault
          </span>
          <h1 className="mt-1 font-display text-headline-lg uppercase text-ink">
            Certificate of Authenticity
          </h1>
          <span className="font-mono text-xs text-muted">
            Permanent Ledger Hash: {inspection.unit_serial}
          </span>
        </div>
        <Link
          href={`/products/${inspection.product.handle}`}
          className="border border-ink bg-ink px-4 py-2 font-mono text-xs uppercase tracking-wider text-surface hover:opacity-90 no-underline"
        >
          View Silhouette in Store →
        </Link>
      </div>

      {/* Main Inspection Component */}
      <InspectionViewer inspection={inspection} />

      {/* Certificate Authenticity Guarantees */}
      <div className="mt-8 border border-line bg-surface p-6 space-y-4">
        <h3 className="font-mono text-xs uppercase tracking-wider text-ink font-semibold">
          The Hidden Label 100% Authentication Promise
        </h3>
        <p className="font-sans text-xs text-on-surface-variant leading-relaxed">
          Every item bearing this unique serial number has passed our multi-point physical verification protocol. Our authentication lab tests material grain density, stitch tension, 365nm UV spectral reaction, factory scent adhesive, packaging typography, and barcode metadata. Any pair failing even a single criterion is permanently excluded from our marketplace.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 border-t border-line text-xs font-mono">
          <div>
            <span className="block text-muted uppercase text-[10px]">Standard</span>
            <span className="font-semibold text-ink">CultureCircle / StockX Grade A</span>
          </div>
          <div>
            <span className="block text-muted uppercase text-[10px]">Verification Date</span>
            <span className="font-semibold text-ink">
              {inspection.inspected_at ? new Date(inspection.inspected_at).toLocaleDateString("en-IN") : "Verified"}
            </span>
          </div>
          <div>
            <span className="block text-muted uppercase text-[10px]">Jurisdiction</span>
            <span className="font-semibold text-ink">India (INR duties included)</span>
          </div>
        </div>
      </div>
    </main>
  );
}
