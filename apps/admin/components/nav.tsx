"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { roleAtLeast, type AdminRole } from "../lib/roles";

interface NavItem {
  href: string;
  label: string;
  code: string;
  /** Cosmetic only — hiding a link is not authorisation. Every backend route re-checks role. */
  minimum: AdminRole;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", code: "A-01", minimum: "support" },
      { href: "/returns?status=requested", label: "Needs attention", code: "A-01b", minimum: "support" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/orders", label: "Orders", code: "A-07", minimum: "support" },
      { href: "/returns", label: "Returns", code: "A-12", minimum: "support" },
      { href: "/products", label: "Products", code: "A-02", minimum: "support" },
      { href: "/brands", label: "Brands", code: "A-04", minimum: "support" },
      { href: "/categories", label: "Categories", code: "A-05", minimum: "support" },
      { href: "/promotions", label: "Promotions", code: "A-13", minimum: "support" },
    ],
  },
  {
    label: "Inventory & fulfilment",
    items: [
      { href: "/inventory", label: "Inventory", code: "A-06", minimum: "support" },
      { href: "/shipments", label: "Shipments", code: "A-11", minimum: "support" },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/customers", label: "Customer directory", code: "A-09", minimum: "support" },
      { href: "/support", label: "Support inbox", code: "A-21", minimum: "support" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/content", label: "CMS", code: "A-14", minimum: "support" },
      { href: "/reviews", label: "Reviews", code: "A-22", minimum: "support" },
    ],
  },
  {
    label: "Finance & reports",
    items: [
      { href: "/payments", label: "Payments & refunds", code: "A-10", minimum: "support" },
      { href: "/reports", label: "Reports", code: "A-15", minimum: "support" },
      { href: "/audit", label: "Audit log", code: "A-17", minimum: "support" },
    ],
  },
  {
    label: "Programmes",
    items: [
      { href: "/inspections", label: "Inspections", code: "A-18", minimum: "support" },
      { href: "/resale", label: "Resale orderbook", code: "A-19", minimum: "support" },
      { href: "/fit-rules", label: "Fit Studio rules", code: "A-20", minimum: "support" },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/settings", label: "Store profile", code: "A-16", minimum: "manager" }],
  },
];

/** Groups hidden entirely when every item inside is filtered out (flag-off or role-gated). */
function visibleGroups(role: AdminRole): NavGroup[] {
  const enableResale = process.env.NEXT_PUBLIC_ENABLE_RESALE === "true";
  const fitStudioEnabled = process.env.NEXT_PUBLIC_FEATURE_FIT_STUDIO === "true";

  return GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!enableResale && (item.href === "/resale" || item.href === "/inspections")) return false;
      if (!fitStudioEnabled && item.href === "/fit-rules") return false;
      // "Needs attention" deep-link only makes sense next to the returns module it filters.
      if (item.href.startsWith("/returns?") && !roleAtLeast(role, "support")) return false;
      return roleAtLeast(role, item.minimum);
    }),
  })).filter((group) => group.items.length > 0);
}

function isActive(pathname: string, href: string): boolean {
  if (href.includes("?")) {
    // Deep links (e.g. /returns?status=requested) never mark a group active.
    return false;
  }
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function GroupLinks({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {group.items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-10 items-center justify-between gap-2 px-4 py-2 font-sans text-body-sm no-underline transition-colors",
                active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <span className={active ? "font-medium" : undefined}>{item.label}</span>
              <span className={active ? "font-mono text-[10px] uppercase text-white/50" : "font-mono text-[10px] uppercase text-white/35"}>
                {item.code}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Desktop sidebar: labelled groups, keyboard-collapsible. */
export function Nav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const groups = visibleGroups(role);

  return (
    <nav aria-label="Admin sections" className="flex flex-col pb-6">
      {groups.map((group) => (
        <NavGroupSection key={group.label} group={group} pathname={pathname} />
      ))}
    </nav>
  );
}

function NavGroupSection({ group, pathname }: { group: NavGroup; pathname: string }) {
  // A group starts expanded when it contains the active page, or by default for the first group.
  const [open, setOpen] = useState(
    group.items.some((item) => isActive(pathname, item.href)),
  );
  const groupActive = group.items.some((item) => isActive(pathname, item.href));

  return (
    <section aria-label={group.label} className="border-b border-white/10 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={[
          "flex min-h-11 w-full items-center justify-between px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
          groupActive ? "text-accent" : "text-white/45 hover:text-white/80",
        ].join(" ")}
      >
        {group.label}
        <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open ? <GroupLinks group={group} pathname={pathname} /> : null}
    </section>
  );
}

/**
 * Mobile/tablet navigation drawer: the sidebar is hidden below `lg`, so the header gains a
 * hamburger that opens the same grouped nav in an overlay. Escape closes, focus returns to the
 * button (mirrors the storefront mobile-nav pattern).
 */
export function MobileAdminNav({ role, actorEmail, actorRole }: { role: AdminRole; actorEmail: string; actorRole: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = visibleGroups(role);

  useEffect(() => {
    // Close on navigation.
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        aria-label="Open admin navigation"
        className="flex min-h-11 min-w-11 items-center justify-center border border-line bg-surface text-ink lg:hidden"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ☰
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-ink/40"
          />
          <div
            id="admin-mobile-nav"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-ink shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-white/10 px-4 py-4">
              <div className="min-w-0">
                <p className="font-display text-headline-sm uppercase tracking-wide text-white">THL Admin</p>
                <p className="mt-1 truncate font-mono text-[11px] uppercase text-white/50">
                  {actorEmail} · {actorRole}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close admin navigation"
                className="flex min-h-11 min-w-11 items-center justify-center font-mono text-body-sm text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label} className="border-b border-white/10">
                  <p className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
                    {group.label}
                  </p>
                  <GroupLinks group={group} pathname={pathname} onNavigate={() => setOpen(false)} />
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
