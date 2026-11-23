"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { roleAtLeast, type AdminRole } from "../lib/roles";

interface NavItem {
  href: string;
  label: string;
  code: string;
  /** Cosmetic only — hiding a link is not authorisation. Every backend route re-checks role. */
  minimum: AdminRole;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", code: "A-01", minimum: "support" },
  { href: "/products", label: "Products", code: "A-02", minimum: "support" },
  { href: "/brands", label: "Brands", code: "A-04", minimum: "support" },
  { href: "/categories", label: "Categories", code: "A-05", minimum: "support" },
  { href: "/inventory", label: "Inventory", code: "A-06", minimum: "support" },
  { href: "/orders", label: "Orders", code: "A-07", minimum: "support" },
  { href: "/customers", label: "Customers", code: "A-09", minimum: "support" },
  { href: "/payments", label: "Payments & refunds", code: "A-10", minimum: "support" },
  { href: "/shipments", label: "Shipments", code: "A-11", minimum: "support" },
  { href: "/returns", label: "Returns", code: "A-12", minimum: "support" },
  { href: "/support", label: "Support inbox", code: "A-21", minimum: "support" },
  { href: "/promotions", label: "Promotions", code: "A-13", minimum: "support" },
  { href: "/content", label: "Content & CMS", code: "A-14", minimum: "support" },
  { href: "/reports", label: "Reports", code: "A-15", minimum: "support" },
  { href: "/inspections", label: "Inspections", code: "A-18", minimum: "support" },
  { href: "/resale", label: "Resale Orderbook", code: "A-19", minimum: "support" },
  { href: "/fit-rules", label: "Fit Studio Rules", code: "A-20", minimum: "support" },
  { href: "/settings", label: "Settings", code: "A-16", minimum: "manager" },
  { href: "/audit", label: "Audit log", code: "A-17", minimum: "support" },
];

export function Nav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const enableResale = process.env.NEXT_PUBLIC_ENABLE_RESALE === "true";
  const fitStudioEnabled = process.env.NEXT_PUBLIC_FEATURE_FIT_STUDIO === "true";

  return (
    <nav aria-label="Admin sections" className="flex flex-col">
      {ITEMS.filter((item) => {
        if (!enableResale && (item.href === "/resale" || item.href === "/inspections")) {
          return false;
        }
        if (!fitStudioEnabled && item.href === "/fit-rules") {
          return false;
        }
        return roleAtLeast(role, item.minimum);
      }).map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 font-sans text-body-sm transition-colors",
              active ? "bg-white text-ink" : "text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            <span>{item.label}</span>
            <span
              className={[
                "font-mono text-[10px] uppercase",
                active ? "text-muted" : "text-white/50",
              ].join(" ")}
            >
              {item.code}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
