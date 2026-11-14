import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/verify-form";
import { getCurrentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your email" };

interface PageProps {
  searchParams: Promise<{ purpose?: string; redirect_to?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const { purpose, redirect_to } = await searchParams;
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-md px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
      <p className="font-mono text-label-caps uppercase text-muted">OTP verification</p>
      <h1 className="type-headline-lg mb-md mt-2 uppercase">Verify your email</h1>

      <VerifyForm
        destination={session.customer.email}
        purpose={purpose ?? "email_verify"}
        redirectTo={redirect_to ?? "/account"}
      />
    </main>
  );
}
