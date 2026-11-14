import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { actorId } from "../../../../lib/auth";

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
  price_rupees?: number;
}

/**
 * POST /store/concierge/chat
 *
 * Aura-7 Style Concierge (AI-05) — FALLBACK MODE ONLY.
 *
 * D2/D7: this is NOT a real LLM yet — replies are keyword-matched templates grounded only in
 * catalogue text, with no model call. Reply text must never claim "verified"/"authenticated"/
 * "deadstock" condition for a product unless that specific unit actually has an approved
 * `condition_inspection` record (see /store/resale/products/:handle/index, which does check
 * this correctly) — this route does not look up inspection records, so it must not make any
 * authentication claim at all. The storefront must keep this entry point hidden behind
 * `NEXT_PUBLIC_FEATURE_AI_LAYER` until a real LLM provider is wired (docs/MASTER_PLAN.md §2.4).
 */
export async function POST(req: MedusaRequest<ChatBody>, res: MedusaResponse) {
  const customerId = actorId(req) ?? null;
  const { thread_id, session_token = "guest-session", message } = req.body ?? {};

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ type: "invalid_data", message: "A non-empty message is required." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // 1. Resolve or create thread
  let activeThreadId = thread_id;
  if (activeThreadId) {
    const thread = await pg("concierge_thread").where({ id: activeThreadId }).first();
    if (!thread) {
      activeThreadId = undefined;
    }
  }

  if (!activeThreadId) {
    activeThreadId = generateEntityId(undefined, "cth");
    await pg("concierge_thread").insert({
      id: activeThreadId,
      customer_id: customerId,
      session_token,
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

  if (first && second) {
    replyText = `Based on your preference for "${message.trim()}", I'd point you toward the ${first.title}. Its archive profile pairs effortlessly with relaxed denim or tailored trousers. For an alternative rotation piece, the ${second.title} brings balanced proportions. Check each product's authenticity report for the specific unit's inspection status before you buy.`;
  } else if (first) {
    replyText = `For "${message.trim()}", the standout silhouette in our catalogue is the ${first.title}. It features iconic heritage lines and premium leather tooling. Pair it with neutral streetwear layers to let the silhouette take center stage — its listing page shows the real inspection status for the unit you'd be buying.`;
  } else {
    replyText = `Welcome to The Hidden Label. Our catalogue spans Nike, Jordan, Adidas, New Balance, and Salomon. Tell me about your preferred color palette, aesthetic, or daily rotation, and I'll tailor a selection from what's currently listed.`;
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
    recommended_products: matchedProducts.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail: p.thumbnail,
      brand: p.brand_name ?? "The Hidden Label",
    })),
  });
}
