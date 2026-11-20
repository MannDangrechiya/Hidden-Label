import type { Knex } from "knex";

/**
 * R-07: the codebase assumed exactly one stock location.
 *
 * Two places picked it with `stock_location.first("id")`, which is an unordered `LIMIT 1`:
 * fulfilment could be told to ship from whichever row PostgreSQL returned first, and a returned
 * unit was restocked into that same arbitrary row. With one location the result is correct by
 * accident; with two it silently moves stock between warehouses.
 *
 * The policy below is not a new business rule, it is the existing intent made explicit:
 *   1. an explicitly requested location wins (operators can always state it);
 *   2. otherwise the location the order was actually fulfilled from — returned goods go back
 *      where they came from, and a split/shipment order ships from the same place;
 *   3. otherwise the only location, when the business genuinely has one;
 *   4. otherwise the request fails closed with an actionable error instead of guessing.
 */

export type StockLocationSource = "requested" | "order" | "only_location";

export type StockLocationDecision =
  | { ok: true; locationId: string; source: StockLocationSource }
  | {
      ok: false;
      code: "location_not_found" | "location_required" | "no_location";
      status: 422;
      message: string;
    };

export interface StockLocationInput {
  /** Location supplied by the operator in the request body. */
  requestedLocationId?: string | null;
  /** Location of the order's most recent fulfilment, when it has one. */
  orderLocationId?: string | null;
  /** Every location that currently exists. */
  availableLocationIds: readonly string[];
}

/** Pure decision function — the whole policy, testable without a database. */
export function decideStockLocation(input: StockLocationInput): StockLocationDecision {
  const available = input.availableLocationIds;

  if (input.requestedLocationId) {
    if (!available.includes(input.requestedLocationId)) {
      return {
        ok: false,
        code: "location_not_found",
        status: 422,
        message: "The requested stock location does not exist.",
      };
    }
    return { ok: true, locationId: input.requestedLocationId, source: "requested" };
  }

  if (input.orderLocationId && available.includes(input.orderLocationId)) {
    return { ok: true, locationId: input.orderLocationId, source: "order" };
  }

  if (available.length === 1) {
    const only = available[0];
    if (only) return { ok: true, locationId: only, source: "only_location" };
  }

  if (available.length === 0) {
    return {
      ok: false,
      code: "no_location",
      status: 422,
      message: "No stock location exists yet, so inventory cannot be updated.",
    };
  }

  return {
    ok: false,
    code: "location_required",
    status: 422,
    message:
      "This business has more than one stock location and the order does not record which one was used. Pass location_id explicitly.",
  };
}

export async function listStockLocationIds(db: Knex): Promise<string[]> {
  const rows = (await db("stock_location").select("id").orderBy("id", "asc")) as { id: string }[];
  return rows.map((row) => row.id);
}

/** The location of the order's most recent fulfilment, if any recorded one. */
export async function orderFulfillmentLocationId(
  db: Knex,
  orderId: string,
): Promise<string | null> {
  const row = (await db("fulfillment as f")
    .join("order_fulfillment as fo", "fo.fulfillment_id", "f.id")
    .where("fo.order_id", orderId)
    .whereNotNull("f.location_id")
    .orderBy("f.created_at", "desc")
    .first("f.location_id")) as { location_id: string | null } | undefined;

  return row?.location_id ?? null;
}

/** Resolve the location for a fulfil/restock action against the live schema. */
export async function resolveStockLocation(
  db: Knex,
  input: { orderId: string; requestedLocationId?: string | null },
): Promise<StockLocationDecision> {
  const [availableLocationIds, orderLocationId] = await Promise.all([
    listStockLocationIds(db),
    orderFulfillmentLocationId(db, input.orderId),
  ]);

  return decideStockLocation({
    requestedLocationId: input.requestedLocationId ?? null,
    orderLocationId,
    availableLocationIds,
  });
}
