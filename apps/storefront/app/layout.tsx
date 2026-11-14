import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Syne } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StyleConcierge } from "@/components/style-concierge";
import { MarketTicker } from "@/components/market-ticker";
import "./globals.css";

// Self-hosted at build time by next/font — no runtime CDN request, no layout shift.
const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hanken",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "The Hidden Label", template: "%s · The Hidden Label" },
  description: "Curated multi-brand footwear and apparel — The Hidden Label.",
  robots: { index: false, follow: false },
};

// D2/D7: the concierge chat is not yet backed by a real LLM — until
// NEXT_PUBLIC_FEATURE_AI_LAYER is on (a real provider key is wired, see
// docs/MASTER_PLAN.md §2.4), it must not be shown to customers.
const AI_LAYER_ENABLED = process.env.NEXT_PUBLIC_FEATURE_AI_LAYER === "true";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${hanken.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col bg-canvas text-on-surface antialiased">
        <MarketTicker />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        {AI_LAYER_ENABLED ? <StyleConcierge /> : null}
      </body>
    </html>
  );
}
