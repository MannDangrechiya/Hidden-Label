import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getCurrentCustomer().catch(() => null);
  if (session) redirect("/account");

  return (
    <main className="mx-auto grid w-full max-w-page gap-xl px-margin py-xl sm:px-margin-tablet lg:grid-cols-2 lg:px-margin-desktop">
      <div className="hidden bg-surface-container lg:block" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
        <div>
          <p className="font-mono text-label-caps uppercase text-muted">Specimen Vault Auth</p>
          <h1 className="type-headline-lg mt-2 uppercase">Sign in</h1>
        </div>

        <LoginForm />

        <p className="font-sans text-body-sm text-on-surface-variant">
          <Link href="/forgot-password" className="underline">
            Forgot your password?
          </Link>
        </p>
        <p className="border-t border-line pt-md font-sans text-body-sm text-on-surface-variant">
          New here?{" "}
          <Link href="/register" className="underline">
            Create a vault account
          </Link>
        </p>
      </div>
    </main>
  );
}
