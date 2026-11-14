import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4 py-16">
      <div className="w-full max-w-sm border border-line bg-surface p-8">
        <p className="mb-1 font-mono text-label-caps uppercase text-muted">The Hidden Label</p>
        <h1 className="mb-6 font-display text-headline-md">Admin sign in</h1>
        <LoginForm from={from && from.startsWith("/") ? from : "/"} />
      </div>
    </main>
  );
}
