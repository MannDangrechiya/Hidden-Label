import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { actorId } from "../../../../lib/auth";
import {
  createGuestSession,
  decideThreadAccess,
  hashGuestSessionToken,
  verifyGuestSessionToken,
} from "../../../../lib/concierge-session";
import { generateConciergeReply, isConfigured as geminiConfigured } from "../../../../lib/gemini";

interface ChatBody {
  thread_id?: string;
  session_token?: string;
  message?: string;
}

interface ProductItem {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  description: string | null;
  brand_name?: string;
}

/**
 * The signing secret for guest concierge sessions. It is derived from the backend's own JWT
 * secret, so a token minted for one environment cannot be replayed in another. With no secret
 * configured the route refuses to issue sessions rather than falling back to an unsigned value.
 */
function conciergeSecret(): string | null {
  return process.env.MEDUSA_JWT_SECRET || process.env.MEDUSA_COOKIE_SECRET || null;
}

/**
 * POST /store/concierge/chat
 *
 * Aura-7 Style Concierge (AI-05). Real LLM reply via Gemini when `GEMINI_API_KEY` is configured
 * — the model only ever sees the real catalogue (see `lib/gemini.ts`'s prompt) and is explicitly
 * told never to invent a product or claim an authentication status it can't know (D2). Falls
 * back to the keyword-matched template below when Gemini isn't configured or the call fails, so
 * the feature degrades to "still useful, still honest" rather than erroring. Either way, no
 * authentication claim is made here — that only ever comes from a real `condition_inspection`
 * record shown on the product's own page. Keep this entry point hidden behind
 * `NEXT_PUBLIC_FEATURE_AI_LAYER` until you're ready to show it (docs/MASTER_PLAN.md §2.4).
 *
 * BUG-09: thread ownership. A signed-in customer can only touch a thread whose `customer_id`
 * matches. A guest thread can only be continued with the exact backend-issued signed session
 * token whose SHA-256 hash is stored. A client-supplied string is verified, never trusted, and
 * a thread with no owner and no hash is inaccessible.
 */
export async function POST(req: MedusaRequest<ChatBody>, res: MedusaResponse) {
  const customerId = actorId(req) ?? null;
  const body = req.body ?? {};
  const message = body.message;
  const requestedThreadId = body.thread_id;
  const presentedToken =
    typeof body.session_token === "string" && body.session_token.trim().length > 0
      ? body.session_token.trim()
      : null;

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ type: "invalid_data", message: "A non-empty message is required." });
    return;
  }

  const secret = conciergeSecret();
  if (!secret) {
    res.status(503).json({
      type: "not_configured",
      message: "The concierge is not configured on this environment.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const presentedHash = presentedToken ? hashGuestSessionToken(presentedToken) : null;

  // 1. Resolve the thread, enforcing ownership before anything is written.
  let activeThreadId = requestedThreadId;
  if (activeThreadId) {
    const thread = await pg("concierge_thread").where({ id: activeThreadId }).first();
    if (!thread) {
      activeThreadId = undefined;
    } else {
      const access = decideThreadAccess(thread, {
        customerId,
        tokenHash: presentedHash,
      });
      if (!access.allowed) {
        res.status(403).json({ type: "forbidden", message: "This conversation is not available." });
        return;
      }
    }
  }

  let issuedToken: string | null = null;

  if (!activeThreadId) {
    let sessionTokenHash: string | null = null;
    let sessionMarker: string = customerId ? `customer:${customerId}` : "guest";

    if (!customerId) {
      // A guest thread is always bound to a backend-issued signed token. A previously issued,
      // still-valid token is reused so a client that lost its thread id keeps the same identity;
      // anything else is replaced rather than trusted.
      const verified = verifyGuestSessionToken(presentedToken, secret);
      if (verified && presentedToken && presentedHash) {
        sessionTokenHash = presentedHash;
      } else {
        const session = createGuestSession(secret);
        issuedToken = session.token;
        sessionTokenHash = session.hash;
      }
      sessionMarker = sessionTokenHash;
    }

    activeThreadId = generateEntityId(undefined, "cth");
    await pg("concierge_thread").insert({
      id: activeThreadId,
      customer_id: customerId,
      session_token: sessionMarker,
      session_token_hash: sessionTokenHash,
      title: message.slice(0, 40) + (message.length > 40 ? "..." : ""),
    });
  }

  // 2. Record user message
  const userMsgId = generateEntityId(undefined, "cmsg");
  await pg("concierge_message").insert({
    id: userMsgId,
    thread_id: activeThreadId,
    sender: "user",
    content: message.trim(),
    recommended_product_ids: JSON.stringify([]),
  });

  // 3. Fetch catalog inventory for grounding
  const catalogProducts = (await pg("product as p")
    .leftJoin("product_brand as pb", "pb.product_id", "p.id")
    .leftJoin("brand as b", "b.id", "pb.brand_id")
    .whereNull("p.deleted_at")
    .andWhere("p.status", "published")
    .select(
      "p.id",
      "p.title",
      "p.handle",
      "p.thumbnail",
      "p.description",
      "b.name as brand_name",
    )) as ProductItem[];

  // 4. Grounded stylist intelligence
  const query = message.toLowerCase();
  let matchedProducts: ProductItem[] = [];

  // Keyword match across brand, title, description
  if (query.includes("jordan") || query.includes("chicago") || query.includes("basketball") || query.includes("red")) {
    matchedProducts = catalogProducts.filter((p) => p.handle.includes("jordan"));
  } else if (query.includes("samba") || query.includes("terrace") || query.includes("white") || query.includes("casual")) {
    matchedProducts = catalogProducts.filter((p) => p.handle.includes("samba") || p.handle.includes("gazelle"));
  } else if (query.includes("trail") || query.includes("salomon") || query.includes("outdoor") || query.includes("black")) {
    matchedProducts = catalogProducts.filter((p) => p.handle.includes("xt-6") || p.handle.includes("panda"));
  } else if (query.includes("comfort") || query.includes("running") || query.includes("grey") || query.includes("walk")) {
    matchedProducts = catalogProducts.filter((p) => p.handle.includes("990v6") || p.handle.includes("gel-kayano"));
  }

  if (matchedProducts.length === 0) {
    matchedProducts = catalogProducts.slice(0, 2);
  } else {
    matchedProducts = matchedProducts.slice(0, 3);
  }

  let replyText = "";
  const first = matchedProducts[0];
  const second = matchedProducts[1];

  if (geminiConfigured()) {
    try {
      replyText = await generateConciergeReply(
        message.trim(),
        catalogProducts.map((p) => ({ title: p.title, handle: p.handle, brand: p.brand_name })),
      );
    } catch (error) {
      const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
      logger.warn(
        `Gemini concierge call failed, falling back to template reply: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (!replyText) {
    if (first && second) {
      replyText = `Based on your preference for "${message.trim()}", I'd point you toward the ${first.title}. Its archive profile pairs effortlessly with relaxed denim or tailored trousers. For an alternative rotation piece, the ${second.title} brings balanced proportions. Check each product's authenticity report for the specific unit's inspection status before you buy.`;
    } else if (first) {
      replyText = `For "${message.trim()}", the standout silhouette in our catalogue is the ${first.title}. It features iconic heritage lines and premium leather tooling. Pair it with neutral streetwear layers to let the silhouette take center stage — its listing page shows the real inspection status for the unit you'd be buying.`;
    } else {
      replyText = `Welcome to The Hidden Label. Our catalogue spans Nike, Jordan, Adidas, New Balance, and Salomon. Tell me about your preferred color palette, aesthetic, or daily rotation, and I'll tailor a selection from what's currently listed.`;
    }
  }

  // 5. Record assistant response
  const assistantMsgId = generateEntityId(undefined, "cmsg");
  const recommendedIds = matchedProducts.map((p) => p.id);

  await pg("concierge_message").insert({
    id: assistantMsgId,
    thread_id: activeThreadId,
    sender: "assistant",
    content: replyText,
    recommended_product_ids: JSON.stringify(recommendedIds),
  });

  res.json({
    thread_id: activeThreadId,
    reply: replyText,
    ...(issuedToken ? { session_token: issuedToken } : {}),
    recommended_products: matchedProducts.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail: p.thumbnail,
      brand: p.brand_name ?? "The Hidden Label",
    })),
  });
}
