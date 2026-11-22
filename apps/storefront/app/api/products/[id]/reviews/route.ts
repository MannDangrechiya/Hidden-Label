import { NextResponse } from "next/server";
import { readAuthToken } from "@/lib/auth-cookie";

const MEDUSA_URL = process.env.MEDUSA_URL ?? "http://localhost:9000";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await readAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Please sign in to submit a review." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await fetch(`${MEDUSA_URL}/store/products/${id}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Failed to submit review." },
      { status: 500 },
    );
  }
}
