import Link from "next/link";
import { CmsPageRenderer } from "@/components/cms-page-renderer";
import { SupportContactForm } from "@/components/support-contact-form";
import { fetchCmsPage } from "@/lib/medusa";
import { RETURN_WINDOW_DAYS } from "@/lib/return-window";
import { getCurrentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support & Client Services — The Hidden Label",
  description: "Contact client support, track orders, and view FAQ assistance.",
};

/**
 * GAP-SUP-01: support is a real, recorded channel. The CMS FAQ (when seeded) is shown as
 * reference material, and the contact form creates a ticket operations can work.
 */
interface PageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function SupportPage({ searchParams }: PageProps) {
  const page = await fetchCmsPage("support").catch(() => null);
  const session = await getCurrentCustomer().catch(() => null);
  const { order } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 border-b border-line pb-sp-3">
        <p className="font-mono text-label-caps uppercase text-muted">Client services</p>
        <h1 className="type-headline-lg mt-2 uppercase">Support</h1>
        <p className="mt-2 max-w-2xl font-sans text-body-sm text-on-surface-variant">
          Every request is recorded with a reference number. We acknowledge within 48 hours and
          resolve within 30 days. Statutory complaints should be addressed to the{" "}
          <Link href="/policies/grievance" className="underline">
            Grievance Officer
          </Link>
          .
        </p>
      </header>

      <div className="grid grid-cols-1 gap-sp-5 lg:grid-cols-[1fr_420px]">
        <section>
          {page ? (
            <CmsPageRenderer page={page} />
          ) : (
            <div className="flex flex-col gap-3 font-sans text-body-sm text-on-surface-variant">
              <h2 className="font-display text-headline-sm uppercase text-ink">Common questions</h2>
              <p>
                <strong className="text-ink">Where is my order?</strong> Open the order in your
                account to see its live fulfilment and tracking status.
              </p>
              <p>
                <strong className="text-ink">How do returns work?</strong> Request a return from the
                delivered order within {RETURN_WINDOW_DAYS} days; we arrange the reverse pickup.
              </p>
              <p>
                <strong className="text-ink">Refunds</strong> are returned to the same UPI account
                or card used to pay, within 5–7 working days of the return being received.
              </p>
            </div>
          )}
        </section>

        <section className="h-fit border border-line p-sp-3">
          <h2 className="mb-sp-3 font-mono text-label-caps uppercase text-muted">
            Contact client services
          </h2>
          <SupportContactForm
            defaultEmail={session?.customer.email ?? ""}
            defaultName={session?.customer.first_name ?? ""}
            orderRef={typeof order === "string" ? order : ""}
          />
        </section>
      </div>
    </main>
  );
}
