import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MobileAdminNav, Nav } from "../../components/nav";
import { LogoutButton } from "../../components/logout-button";
import { requireSessionToken, isUnauthorized } from "../../lib/backend";
import { fetchCurrentAdmin, isNoRoleAssigned } from "../../lib/api/auth";
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

    // SEC-01: authenticated but without an explicit role. Deny, never render the console with a
    // default role. The backend refuses the same account with 403 no_role_assigned.
    if (isNoRoleAssigned(error)) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
          <div className="max-w-md border border-line bg-surface p-8 text-center">
            <span className="font-mono text-xs uppercase tracking-widest text-error">
              Access denied
            </span>
            <h1 className="mt-2 font-display text-headline-lg uppercase text-ink">
              No staff role assigned
            </h1>
            <p className="mt-3 font-sans text-body-sm leading-relaxed text-on-surface-variant">
              Your account is signed in but has no role. An owner must assign one of{" "}
              <span className="font-mono">owner</span>, <span className="font-mono">manager</span>,{" "}
              <span className="font-mono">operations</span>, <span className="font-mono">support</span> or{" "}
              <span className="font-mono">readonly</span> before you can use the console.
            </p>
            <div className="mt-6 flex justify-center">
              <LogoutButton />
            </div>
          </div>
        </div>
      );
    }

    throw error;
  }

  const email = actor.user.email ?? actor.user.id;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar lives on desktop only; below `lg` the header hamburger opens the grouped drawer. */}
      <aside className="hidden w-60 shrink-0 flex-col bg-ink text-white lg:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <p className="font-display text-headline-sm uppercase tracking-wide">THL Admin</p>
          <p className="mt-1 font-mono text-[11px] uppercase text-white/50">Operations console</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Nav role={actor.role} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MobileAdminNav role={actor.role} actorEmail={email} actorRole={actor.role} />
            <p className="truncate font-display text-headline-sm uppercase tracking-wide text-ink lg:hidden">
              THL Admin
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="max-w-[220px] truncate font-sans text-body-sm text-ink">{email}</p>
              <p className="font-mono text-[11px] uppercase text-muted">{actor.role}</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 bg-canvas px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
