import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/register-form";
import { getCurrentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const session = await getCurrentCustomer().catch(() => null);
  if (session) redirect("/account");

  return (
    <main className="mx-auto grid w-full max-w-page gap-xl px-margin py-xl sm:px-margin-tablet lg:grid-cols-2 lg:px-margin-desktop">
      <div className="hidden bg-surface-container lg:block" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
        <div>
          <p className="font-mono text-label-caps uppercase text-muted">Create vault account</p>
          <h1 className="type-headline-lg mt-2 uppercase">Register</h1>
          <p className="mt-2 font-sans text-body-sm text-on-surface-variant">
            We verify your email with a one-time code after you register — no documents, no KYC.
          </p>
        </div>

        <RegisterForm />

        <p className="border-t border-line pt-md font-sans text-body-sm text-on-surface-variant">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
