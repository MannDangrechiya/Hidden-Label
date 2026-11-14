import { MedusaService } from "@medusajs/framework/utils";
import {
  BannerSlot,
  Brand,
  CmsPage,
  OtpChallenge,
  ReturnItem,
  ReturnRequest,
  Shipment,
  ShipmentEvent,
  WishlistItem,
} from "./models";

/**
 * Project-owned commerce tables (docs/DATABASE_PLAN.md §2–§9).
 *
 * One module rather than seven keeps the migration chain in the documented order and lets the
 * RMA/shipment/audit reads join each other without cross-module remote links. The tables and
 * API surface are exactly the documented ones.
 */
class ThlModuleService extends MedusaService({
  BannerSlot,
  Brand,
  CmsPage,
  OtpChallenge,
  ReturnItem,
  ReturnRequest,
  Shipment,
  ShipmentEvent,
  WishlistItem,
}) {}

export default ThlModuleService;
