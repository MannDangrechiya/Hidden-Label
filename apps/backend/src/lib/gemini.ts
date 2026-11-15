/**
 * Google Gemini client — real HTTP calls to the Gemini API, used to make the Style Concierge
 * (AI-05) and Search by Sight (AI-01) genuinely AI-backed instead of the keyword-matching
 * fallback in concierge/chat and sight-search routes.
 *
 * D2/D7 (docs/MASTER_PLAN.md §2.4): both AI-01 and AI-05 were deliberately built as honest
 * fallbacks until a real provider key was available. This client activates the real behaviour
 * the moment `GEMINI_API_KEY` is set — get a free key at https://aistudio.google.com/apikey
 * (no credit card required for the free tier as of this writing; verify current terms before
 * relying on it for production volume). Nothing here has been exercised against a live key in
 * this environment — unit tests mock `fetch`.
 */

// Checked live against a real key on 2026-11-14. "gemini-2.0-flash" is fully retired;
// "gemini-2.5-flash" is retired for new accounts specifically; pinned "gemini-3.8-flash"
// intermittently 503s under free-tier demand. "gemini-flash-latest" is Google's own rolling
// alias for their current fast model, not a version number that goes stale — use it instead of
// guessing a pinned name. If it ever errors, call the models.list endpoint with the real key
// (GET https://generativelanguage.googleapis.com/v1beta/models?key=...) to see what this
// specific account can actually use before picking a replacement.
const DEFAULT_MODEL = "gemini-flash-latest";

export function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function apiUrl(model: string): string {
  const key = process.env.GEMINI_API_KEY;
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Google's free tier is flaky — confirmed live on 2026-11-14 (same key, same model, back-to-back
 * calls): sometimes a fast real response, sometimes a 503 "high demand", sometimes the request
 * just hangs past a 30s client timeout with no HTTP response at all. One retry after a short
 * delay, covering BOTH a 503 response and a thrown timeout/network error, turns most of those
 * into a real answer instead of an immediate fallback to the keyword-matched template.
 */
async function callOnce(model: string, parts: GeminiPart[]): Promise<Response> {
  return fetch(apiUrl(model), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
    signal: AbortSignal.timeout(2_000),
  });
}

async function callWithRetry(model: string, parts: GeminiPart[]): Promise<Response> {
  try {
    const response = await callOnce(model, parts);
    if (response.ok || response.status !== 503) return response;
  } catch {
    // fall through to the retry below — covers a thrown timeout/network error, not just a 503
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  return callOnce(model, parts);
}

async function generateContent(parts: GeminiPart[]): Promise<string> {
  if (!isConfigured()) {
    throw new Error("Gemini is not configured (GEMINI_API_KEY missing).");
  }
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  const response = await callWithRetry(model, parts);

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as GeminiResponse;
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no text in its response.");
  }
  return text.trim();
}

export interface ConciergeCatalogItem {
  title: string;
  handle: string;
  brand?: string;
}

/**
 * Real, catalogue-grounded chat reply. The prompt explicitly forbids claiming authentication
 * status the model has no way to know (D2) — the caller still only shows a "verified" badge
 * from the real condition_inspection record elsewhere on the product page, never from this text.
 */
export async function generateConciergeReply(
  userMessage: string,
  catalogue: ConciergeCatalogItem[],
): Promise<string> {
  const catalogueText = catalogue
    .slice(0, 40)
    .map((p) => `- ${p.title}${p.brand ? ` (${p.brand})` : ""} [/products/${p.handle}]`)
    .join("\n");

  const prompt = `You are the style concierge for "The Hidden Label", a multi-brand sneaker and streetwear resale marketplace in India. Recommend 1-3 items ONLY from the catalogue list below — never invent a product that isn't listed. Keep the reply under 80 words, warm and specific. Do NOT claim any item is "verified", "authenticated" or "deadstock" — you have no way to know a specific unit's inspection status; only say that if the customer should check the item's own listing for its real authentication report.

Catalogue:
${catalogueText}

Customer message: "${userMessage}"`;

  return generateContent([{ text: prompt }]);
}

/**
 * Real image analysis for Search by Sight. Fetches the image server-side (so no client-supplied
 * URL ever becomes a direct request from Gemini's servers to an attacker-controlled endpoint)
 * and sends it to Gemini as inline data, asking for short descriptive keywords only — the
 * caller matches those keywords against the real catalogue, it never trusts the model to invent
 * a product.
 */
export async function analyzeSneakerImage(imageUrl: string): Promise<string[]> {
  const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
  if (!imageResponse.ok) {
    throw new Error(`Could not fetch the image to analyse: ${imageResponse.status}`);
  }
  const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const base64 = buffer.toString("base64");

  const prompt =
    "This is a photo of a sneaker. Reply with ONLY a comma-separated list of 3-6 short keywords describing it — brand, model/silhouette, and colourway if visible. No sentences, no extra text.";

  const text = await generateContent([
    { text: prompt },
    { inline_data: { mime_type: mimeType, data: base64 } },
  ]);

  return text
    .split(",")
    .map((kw) => kw.trim().toLowerCase())
    .filter(Boolean);
}
