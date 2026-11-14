import { NextResponse } from "next/server";
import { fetchSearchSuggestions, MedusaError } from "@/lib/medusa";

/**
 * Thin proxy so the search overlay (a client component) never needs the publishable key or a
 * direct cross-origin call to Medusa — it only ever talks to this same-origin route.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  try {
    const result = await fetchSearchSuggestions(q);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof MedusaError ? error.message : "Search is unavailable.";
    return NextResponse.json({ products: [], brands: [], error: message }, { status: 502 });
  }
}
