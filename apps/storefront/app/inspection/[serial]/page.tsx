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
          {/* D2: no "ledger"/"hash" language — this is a plain serial, not a cryptographic
              record. D2 explicitly forbids implying a Merkle/tamper-evident ledger exists. */}
          <span className="font-mono text-xs text-muted">Unit Serial: {inspection.unit_serial}</span>
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

      {/* D2: this is the real certificate for a unit with an approved condition_inspection
          record — but the claims on it still must be real. Removed: naming real competitors
          (CultureCircle/StockX) as if this platform uses or is affiliated with their grading
          standard (false affiliation risk), and a fabricated lab-test list ("365nm UV spectral
          reaction", "factory scent adhesive") that doesn't match the actual recorded process
          (box labelling, size tags, stitching, sole tooling, material feel — see the seeded
          Authenticity CMS page). */}
      <div className="mt-8 border border-line bg-surface p-6 space-y-4">
        <h3 className="font-mono text-xs uppercase tracking-wider text-ink font-semibold">
          Inspection Report
        </h3>
        <p className="font-sans text-xs text-on-surface-variant leading-relaxed">
          This unit was reviewed against box labelling, size tags, stitching, sole tooling and
          material feel, compared to the brand&rsquo;s own reference. The grade and notes below
          are this unit&rsquo;s real, recorded result.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 border-t border-line text-xs font-mono">
          <div>
            <span className="block text-muted uppercase text-[10px]">Condition grade</span>
            <span className="font-semibold text-ink">{inspection.condition_grade}</span>
          </div>
          <div>
            <span className="block text-muted uppercase text-[10px]">Inspection Date</span>
            <span className="font-semibold text-ink">
              {inspection.inspected_at ? new Date(inspection.inspected_at).toLocaleDateString("en-IN") : "Pending"}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
