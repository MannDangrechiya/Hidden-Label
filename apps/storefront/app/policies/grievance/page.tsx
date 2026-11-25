import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Grievance Officer — The Hidden Label",
  description:
    "Statutory grievance redressal under the Consumer Protection (E-Commerce) Rules, 2020 and the DPDP Act, 2023.",
};

/**
 * GAP-SUP-02: the Consumer Protection (E-Commerce) Rules, 2020 require a named Grievance
 * Officer, contact details, and a stated acknowledgement/resolution timeline. Previously the
 * store published none of this.
 */
export default function GrievancePage() {
  const officerName = process.env.GRIEVANCE_OFFICER_NAME ?? "Grievance Officer";
  const officerEmail = process.env.GRIEVANCE_OFFICER_EMAIL ?? "grievance@thehiddenlabel.com";
  // No invented fallback phone number: a fabricated statutory contact is worse than none.
  // The owner-supplied number (GRIEVANCE_OFFICER_PHONE) is the only source.
  const officerPhone = process.env.GRIEVANCE_OFFICER_PHONE ?? "";
  const officerAddress =
    process.env.GRIEVANCE_OFFICER_ADDRESS ??
    "Steller, 205, 2nd Floor, Sindhu Bhavan Road, Bodakdev, Ahmedabad, Gujarat 380059, India";
  const legalName = process.env.BUSINESS_LEGAL_NAME ?? "The Hidden Label Luxury Retail Pvt Ltd";
  const hours = process.env.GRIEVANCE_OFFICER_HOURS ?? "Monday to Saturday, 10:00–19:00 IST";

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="border-b border-line pb-sp-3">
        <p className="font-mono text-label-caps uppercase text-muted">Consumer redressal</p>
        <h1 className="type-headline-lg mt-2 uppercase">Grievance Officer</h1>
        <p className="mt-2 max-w-2xl font-sans text-body-sm text-on-surface-variant">
          Every complaint is acknowledged within <strong>48 hours</strong> and resolved within{" "}
          <strong>30 days</strong> of receipt, as required by the Consumer Protection
          (E-Commerce) Rules, 2020. Personal-data requests under the DPDP Act, 2023 follow the
          same channel.
        </p>
      </header>

      <div className="mt-sp-4 grid gap-sp-4 lg:grid-cols-2">
        <section className="border border-line p-sp-3">
          <h2 className="mb-sp-2 font-display text-headline-sm uppercase">Officer details</h2>
          <dl className="m-0 grid grid-cols-[92px_minmax(0,1fr)] gap-y-2 font-sans text-body-sm sm:grid-cols-[120px_minmax(0,1fr)] [&>dd]:break-words">
            <dt className="font-mono text-label-caps uppercase text-muted">Name</dt>
            <dd className="m-0 text-ink">{officerName}</dd>
            <dt className="font-mono text-label-caps uppercase text-muted">Email</dt>
            <dd className="m-0 text-ink">
              <a href={`mailto:${officerEmail}`} className="underline">
                {officerEmail}
              </a>
            </dd>
            <dt className="font-mono text-label-caps uppercase text-muted">Phone</dt>
            <dd className="m-0 text-ink">
              {officerPhone ? (
                <a href={`tel:${officerPhone.replace(/\s/g, "")}`} className="underline">
                  {officerPhone}
                </a>
              ) : (
                "To be published"
              )}
            </dd>
            <dt className="font-mono text-label-caps uppercase text-muted">Hours</dt>
            <dd className="m-0 text-ink">{hours}</dd>
            <dt className="font-mono text-label-caps uppercase text-muted">Address</dt>
            <dd className="m-0 text-ink">
              {legalName}, {officerAddress}
            </dd>
          </dl>
        </section>

        <section className="border border-line p-sp-3">
          <h2 className="mb-sp-2 font-display text-headline-sm uppercase">How a complaint runs</h2>
          <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 font-sans text-body-sm text-on-surface-variant">
            <li>Submit the complaint through the support form, or email the officer directly.</li>
            <li>
              You receive a ticket reference immediately and a written acknowledgement within 48
              hours.
            </li>
            <li>
              The officer investigates with the relevant team and resolves the complaint within 30
              days. Where a refund is due, it is released to the original instrument (or your UPI
              or bank details for a Cash-on-Delivery order).
            </li>
            <li>
              If you are not satisfied, the escalation path and the consumer commission options are
              stated in the resolution letter.
            </li>
          </ol>
          <Link
            href="/support"
            className="mt-sp-3 inline-flex min-h-11 items-center justify-center border border-ink bg-ink px-5 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline hover:bg-accent hover:text-ink"
          >
            Submit a complaint
          </Link>
        </section>
      </div>

      <section className="mt-sp-4 border border-line p-sp-3">
        <h2 className="mb-2 font-display text-headline-sm uppercase">Data-principal rights</h2>
        <p className="font-sans text-body-sm text-on-surface-variant">
          You may request access to your personal data, its correction, or its erasure. Erasure is
          available self-service from <Link href="/account" className="underline">your account</Link>
          ; a request can also be sent to the officer above. Records that tax and consumer-protection
          law require us to retain are kept in a redacted form after erasure.
        </p>
      </section>
    </main>
  );
}
