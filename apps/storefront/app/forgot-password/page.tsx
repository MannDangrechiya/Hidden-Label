import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <p className="font-mono text-label-caps uppercase text-muted">Session recovery</p>
      <h1 className="type-headline-lg mb-2 mt-2 uppercase">Reset your password</h1>
      <p className="mb-sp-3 font-sans text-body-sm text-on-surface-variant">
        Enter the email on your account and we&rsquo;ll send a link to set a new password.
      </p>

      <ForgotPasswordForm />

      <p className="mt-sp-3 border-t border-line pt-sp-3 font-sans text-body-sm text-on-surface-variant">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
