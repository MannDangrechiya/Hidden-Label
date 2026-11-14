import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/medusa";

export const dynamic = "force-dynamic";

export async function GET() {
  const target = backendUrl();
  const started = Date.now();

  let backend: "up" | "down" | "unreachable" = "unreachable";
  try {
    const response = await fetch(`${target}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    backend = response.ok ? "up" : "down";
  } catch {
    backend = "unreachable";
  }

  return NextResponse.json(
    {
      status: "ok",
      app: "storefront",
      backend: { url: target, status: backend, latencyMs: Date.now() - started },
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
