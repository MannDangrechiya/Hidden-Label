import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — Admin dashboard health check.
 * Probed by reverse proxies and container orchestrators.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: "admin",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
