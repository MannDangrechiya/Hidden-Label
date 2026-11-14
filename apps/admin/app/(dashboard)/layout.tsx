import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Nav } from "../../components/nav";
import { LogoutButton } from "../../components/logout-button";
import { requireSessionToken, isUnauthorized } from "../../lib/backend";
import { fetchCurrentAdmin } from "../../lib/api/auth";
import { clearSessionToken } from "../../lib/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireSessionToken();

  let actor;
  try {
    actor = await fetchCurrentAdmin();
  } catch (error) {
    if (isUnauthorized(error)) {
      await clearSessionToken();
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col bg-ink text-white">
        <div className="border-b border-white/10 px-4 py-5">
          <p className="font-display text-headline-sm uppercase tracking-wide">THL Admin</p>
          <p className="mt-1 font-mono text-[11px] uppercase text-white/50">Operations console</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Nav role={actor.role} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <div />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-sans text-body-sm text-ink">{actor.user.email ?? actor.user.id}</p>
              <p className="font-mono text-[11px] uppercase text-muted">{actor.role}</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 bg-canvas px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
