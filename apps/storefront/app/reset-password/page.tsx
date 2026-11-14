import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata = { title: "Reset password" };

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <p className="font-mono text-label-caps uppercase text-muted">Session recovery</p>
      <h1 className="type-headline-lg mb-sp-3 mt-2 uppercase">Choose a new password</h1>

      {!token ? (
        <p role="alert" className="border border-error px-4 py-3 font-sans text-body-sm text-error">
          This link is missing its token. Request a new reset link from the forgot-password page.
        </p>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </main>
  );
}
