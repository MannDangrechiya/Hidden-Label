import type { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  generateEntityId,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  batchLinksWorkflow,
  createApiKeysWorkflow,
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  createLocationFulfillmentSetWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";
import { hsnForProduct, PACKAGE_BY_CATEGORY } from "../lib/hsn";
import { ensureIndiaTaxSetup } from "../lib/tax";
import { THL_MODULE } from "../modules/thl";
import type ThlModuleService from "../modules/thl/service";

/**
 * Development/demo seed. Idempotent: each run produces the same catalogue, brands, CMS pages and
 * shipping options.
 *
 * Refuses to run in production — seed data must never reach a live store
 * (docs/DATABASE_PLAN.md §12).
 */

interface SeedBrand {
  handle: string;
  name: string;
  tagline: string;
  description: string;
  tier: string;
  country: string;
  sortOrder: number;
}

interface SeedProduct {
  title: string;
  handle: string;
  brand: string;
  priceRupees: number;
  sizes: string[];
  skuPrefix: string;
  image: string;
  description: string;
  /** Drives the storefront category tabs and the made-to-measure drawer. */
  category?: "ready_to_wear" | "bespoke_custom" | "footwear" | "accessory";
  gender?: "men" | "women" | "unisex";
  /** True for pieces the atelier cuts to the client's own measurements. */
  bespoke?: boolean;
}

interface SeedCategory {
  handle: string;
  name: string;
  parentHandle?: string;
}

/**
 * The real `product_category` taxonomy (admin A-05 tree, storefront mega-menu), seeded
 * idempotently and kept separate from `lib/catalog.ts`'s metadata-driven storefront tabs — a
 * product can appear in both systems without them needing to agree.
 */
const CATEGORY_TREE: SeedCategory[] = [
  { handle: "footwear", name: "Footwear" },
  { handle: "footwear-sneakers", name: "Sneakers", parentHandle: "footwear" },
  { handle: "footwear-formal", name: "Formal Shoes", parentHandle: "footwear" },
  { handle: "apparel", name: "Apparel" },
  { handle: "apparel-menswear", name: "Menswear", parentHandle: "apparel" },
  { handle: "apparel-womenswear", name: "Womenswear", parentHandle: "apparel" },
  { handle: "accessories", name: "Accessories" },
  { handle: "accessories-bags", name: "Bags", parentHandle: "accessories" },
  { handle: "accessories-eyewear", name: "Eyewear", parentHandle: "accessories" },
  { handle: "accessories-fragrance", name: "Fragrance", parentHandle: "accessories" },
  { handle: "bespoke", name: "Bespoke" },
];

/** Which category handles a seeded product belongs to — derived from the same fields the
 *  storefront's `category`/`gender` metadata already carries, never invented separately. */
function categoryHandlesFor(product: SeedProduct): string[] {
  // Matches the same implicit default the product's own metadata.category gets at creation time
  // (`category: product.category ?? "footwear"`) — the oldest seed entries predate this field.
  const category = product.category ?? "footwear";

  if (category === "bespoke_custom") return ["bespoke"];

  if (category === "footwear") return ["footwear-sneakers"];

  if (category === "accessory") {
    const title = product.title.toLowerCase();
    if (/bag|tote|backpack/.test(title)) return ["accessories-bags"];
    if (/sunglass|eyewear|glasses/.test(title)) return ["accessories-eyewear"];
    if (/parfum|eau de|fragrance|cologne|oud/.test(title)) return ["accessories-fragrance"];
    return ["accessories"];
  }

  // ready_to_wear (or undeclared): split by gender the same way lib/catalog.ts does.
  if (product.gender === "unisex") return ["apparel-menswear", "apparel-womenswear"];
  if (product.gender === "women") return ["apparel-womenswear"];
  if (product.gender === "men") return ["apparel-menswear"];
  return ["apparel"];
}

const BRANDS: SeedBrand[] = [
  {
    handle: "nike",
    name: "Nike",
    tagline: "Originals, kept in rotation.",
    description:
      "The Oregon archive: basketball silhouettes, running tooling and the collaborations that moved the culture. Sourced in limited runs.",
    tier: "flagship",
    country: "United States",
    sortOrder: 1,
  },
  {
    handle: "jordan",
    name: "Jordan",
    tagline: "The line that changed the court.",
    description:
      "Numbered signatures and team editions, from the 1985 original to the modern retro programme.",
    tier: "flagship",
    country: "United States",
    sortOrder: 2,
  },
  {
    handle: "adidas",
    name: "Adidas",
    tagline: "Terrace classics and track staples.",
    description:
      "Three stripes from Herzogenaurach — football terrace icons, indoor silhouettes and the Samba line that never left.",
    tier: "core",
    country: "Germany",
    sortOrder: 3,
  },
  {
    handle: "new-balance",
    name: "New Balance",
    tagline: "Made in the USA, worn everywhere.",
    description:
      "Grey suede, ABZORB cushioning and a manufacturing history in Massachusetts and the UK.",
    tier: "core",
    country: "United States",
    sortOrder: 4,
  },
  {
    handle: "asics",
    name: "ASICS",
    tagline: "Gel-cushioned running heritage.",
    description:
      "Japanese performance engineering — the Gel-Kayano and Gel-Nimbus lines that defined technical runners.",
    tier: "core",
    country: "Japan",
    sortOrder: 5,
  },
  {
    handle: "salomon",
    name: "Salomon",
    tagline: "Trail technology for the city.",
    description:
      "Annecy trail engineering that crossed into everyday wear: XT-6, Speedcross and the S/LAB programme.",
    tier: "partner",
    country: "France",
    sortOrder: 6,
  },
  {
    handle: "the-hidden-label",
    name: "The Hidden Label / Harvi Fashion",
    tagline: "Cut to measure on Sindhu Bhavan Road.",
    description:
      "The in-house atelier: bespoke shirting, suits, co-ords and made-to-measure streetwear, cut and finished by our own tailors in Ahmedabad.",
    tier: "flagship",
    country: "India",
    sortOrder: 7,
  },
  {
    handle: "represent",
    name: "Represent",
    tagline: "British streetwear, heavyweight cotton.",
    description:
      "Manchester-born label built on heavyweight fleece, hand-finished distressing and a monochrome palette.",
    tier: "core",
    country: "United Kingdom",
    sortOrder: 8,
  },
  {
    handle: "fear-of-god",
    name: "Fear of God",
    tagline: "Elevated American essentials.",
    description:
      "Jerry Lorenzo's Los Angeles label: dropped shoulders, muted tones and luxury-grade fabrics.",
    tier: "flagship",
    country: "United States",
    sortOrder: 9,
  },
  {
    handle: "essentials",
    name: "Essentials",
    tagline: "Fear of God, simplified.",
    description:
      "The diffusion line from Fear of God — relaxed hoodies, tees and sweatpants in a tight neutral range.",
    tier: "core",
    country: "United States",
    sortOrder: 10,
  },
  {
    handle: "palm-angels",
    name: "Palm Angels",
    tagline: "Moncler-backed Milanese skate couture.",
    description:
      "Francesco Ragazzi's Milan label: track jackets, wide-leg trousers and the palm logo in bold placements.",
    tier: "core",
    country: "Italy",
    sortOrder: 11,
  },
  {
    handle: "off-white",
    name: "Off-White",
    tagline: "The arrow, the quotation marks, the tape.",
    description:
      "Virgil Abloh's Milan house — industrial belts, arrow motifs and sunglasses that read as instantly as a logo.",
    tier: "flagship",
    country: "Italy",
    sortOrder: 12,
  },
];

const IMAGES = {
  jordan1:
    "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80",
  samba:
    "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80",
  dunk: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
  nb: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80",
  asics:
    "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80",
  salomon:
    "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80",
  gazelle:
    "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1200&q=80",
  jordan4:
    "https://images.unsplash.com/photo-1512374382149-233c42b6a83b?auto=format&fit=crop&w=1200&q=80",
  shirt:
    "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=1200&q=80",
  suit: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1200&q=80",
  coord:
    "https://images.unsplash.com/photo-1626497764746-6dc36546b388?auto=format&fit=crop&w=1200&q=80",
  hoodie:
    "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?auto=format&fit=crop&w=1200&q=80",
  jacket:
    "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1200&q=80",
  tee: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
};

const PRODUCTS: SeedProduct[] = [
  {
    title: "Air Jordan 1 Retro High OG 'Chicago'",
    handle: "air-jordan-1-retro-high-og-chicago",
    brand: "nike",
    priceRupees: 38990,
    sizes: ["UK 7.0", "UK 8.0", "UK 9.0"],
    skuPrefix: "DZ5485-612",
    image: IMAGES.jordan1,
    description:
      "The 1985 original in white, black and varsity red. Full-grain leather upper, Air-Sole unit and the wings logo at the collar.",
  },
  {
    title: "Samba OG 'Cloud White'",
    handle: "samba-og-cloud-white",
    brand: "adidas",
    priceRupees: 12999,
    sizes: ["UK 7.0", "UK 8.0", "UK 9.0", "UK 10.0"],
    skuPrefix: "B75806",
    image: IMAGES.samba,
    description:
      "Indoor football heritage in white leather with a gum sole and suede T-toe. A terrace classic since 1950.",
  },
  {
    title: "Dunk Low 'Panda'",
    handle: "dunk-low-panda",
    brand: "nike",
    priceRupees: 11995,
    sizes: ["UK 8.0", "UK 9.0"],
    skuPrefix: "DD1391-100",
    image: IMAGES.dunk,
    description:
      "Black and white leather Dunk Low with a low-cut collar and foam midsole. The everyday rotation pair.",
  },
  {
    title: "990v6 'Grey'",
    handle: "990v6-grey",
    brand: "new-balance",
    priceRupees: 21999,
    sizes: ["UK 7.0", "UK 8.0", "UK 9.0", "UK 10.0"],
    skuPrefix: "M990GL6",
    image: IMAGES.nb,
    description:
      "Pigskin suede and mesh upper over FuelCell midsole foam. Made in USA, in the grey that started it all.",
  },
  {
    title: "Gel-Kayano 14 'Silver'",
    handle: "gel-kayano-14-silver",
    brand: "asics",
    priceRupees: 15999,
    sizes: ["UK 7.0", "UK 8.0", "UK 9.0"],
    skuPrefix: "1201A019",
    image: IMAGES.asics,
    description:
      "2008 running technology with GEL cushioning and a TPU heel counter, returned in a metallic silver palette.",
  },
  {
    title: "XT-6 'Vanilla Ice'",
    handle: "xt-6-vanilla-ice",
    brand: "salomon",
    priceRupees: 18999,
    sizes: ["UK 7.0", "UK 8.0", "UK 9.0", "UK 10.0"],
    skuPrefix: "L41086600",
    image: IMAGES.salomon,
    description:
      "Trail-built XT-6 with a textile upper, Quicklace system and Mud Contagrip outsole. Designed in Annecy.",
  },
  {
    title: "Gazelle Indoor 'Collegiate Green'",
    handle: "gazelle-indoor-collegiate-green",
    brand: "adidas",
    priceRupees: 9999,
    sizes: ["UK 7.0", "UK 8.0", "UK 9.0"],
    skuPrefix: "H06259",
    image: IMAGES.gazelle,
    description:
      "Suede Gazelle Indoor with a gum outsole and contrast heel tab. A low-profile terrace staple.",
  },
  {
    title: "Air Jordan 4 Retro 'Bred Reimagined'",
    handle: "air-jordan-4-bred-reimagined",
    brand: "jordan",
    priceRupees: 22990,
    sizes: ["UK 8.0", "UK 9.0", "UK 10.0"],
    skuPrefix: "FV5029-006",
    image: IMAGES.jordan4,
    description:
      "The 1989 design in black and fire red, rebuilt with a premium leather upper and visible Air unit.",
    category: "footwear",
    gender: "unisex",
  },
  {
    title: "Ivory Linen Bespoke Shirt",
    handle: "bespoke-ivory-linen-shirt",
    brand: "the-hidden-label",
    priceRupees: 8490,
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    skuPrefix: "THL-BS-LINEN",
    image: IMAGES.shirt,
    description:
      "Irish linen cut to your own chest, waist and shoulder measurements, with a hand-finished collar and mother-of-pearl buttons. Made in the Sindhu Bhavan Road atelier in 10–14 days.",
    category: "bespoke_custom",
    gender: "men",
    bespoke: true,
  },
  {
    title: "Charcoal Wool Made-to-Measure Suit",
    handle: "bespoke-charcoal-wool-suit",
    brand: "the-hidden-label",
    priceRupees: 38990,
    sizes: ["S", "M", "L", "XL"],
    skuPrefix: "THL-BS-SUIT",
    image: IMAGES.suit,
    description:
      "Half-canvassed two-piece in Super 120s wool, cut to measure with a working cuff and your choice of lapel. Two fittings at the boutique are included.",
    category: "bespoke_custom",
    gender: "men",
    bespoke: true,
  },
  {
    title: "Silk Co-ord Set 'Bone'",
    handle: "silk-coord-set-bone",
    brand: "the-hidden-label",
    priceRupees: 24990,
    sizes: ["XS", "S", "M", "L"],
    skuPrefix: "THL-RTW-COORD",
    image: IMAGES.coord,
    description:
      "Mulberry silk shirt and wide-leg trouser in warm bone, finished with covered buttons. Also available made-to-measure in the atelier.",
    category: "ready_to_wear",
    gender: "women",
  },
  {
    title: "Owners Club Hoodie",
    handle: "represent-owners-club-hoodie",
    brand: "represent",
    priceRupees: 18990,
    sizes: ["S", "M", "L", "XL"],
    skuPrefix: "REP-OCH",
    image: IMAGES.hoodie,
    description:
      "Heavyweight loopback cotton hoodie with a boxy body, ribbed cuffs and the Owners Club print at the chest.",
    category: "ready_to_wear",
    gender: "men",
  },
  {
    title: "Essentials Pullover Hoodie",
    handle: "essentials-pullover-hoodie",
    brand: "essentials",
    priceRupees: 12990,
    sizes: ["XS", "S", "M", "L", "XL"],
    skuPrefix: "FOG-ESS-HOOD",
    image: IMAGES.hoodie,
    description:
      "Brushed-back fleece hoodie from the Fear of God diffusion line, in the house's muted neutral palette with a rubberised logo.",
    category: "ready_to_wear",
    gender: "unisex",
  },
  {
    title: "Palm Angels Track Jacket",
    handle: "palm-angels-track-jacket",
    brand: "palm-angels",
    priceRupees: 34990,
    sizes: ["S", "M", "L"],
    skuPrefix: "PA-TRK-JKT",
    image: IMAGES.jacket,
    description:
      "Technical track jacket with contrast taping down the sleeves and the palm logo at the chest, cut for a relaxed shoulder.",
    category: "ready_to_wear",
    gender: "men",
  },
  {
    title: "Arrows Oversized Tee",
    handle: "off-white-arrows-oversized-tee",
    brand: "off-white",
    priceRupees: 21990,
    sizes: ["XS", "S", "M", "L"],
    skuPrefix: "OW-ARR-TEE",
    image: IMAGES.tee,
    description:
      "Oversized cotton jersey tee with the diagonal arrows print across the back and the house logo at the chest.",
    category: "ready_to_wear",
    gender: "unisex",
  },
  {
    title: "Cathedral Sunglasses",
    handle: "off-white-cathedral-sunglasses",
    brand: "off-white",
    priceRupees: 21999,
    sizes: ["Standard"],
    skuPrefix: "OW-SUN-CATH",
    image: IMAGES.jacket,
    description:
      "Acetate frames with the arrow motif at the temple and category-3 lenses. Supplied with the house case and cloth.",
    category: "accessory",
    gender: "unisex",
  },
  {
    title: "Oud No. 1 Eau de Parfum",
    handle: "thl-oud-no-1",
    brand: "the-hidden-label",
    priceRupees: 12990,
    sizes: ["50 ml", "100 ml"],
    skuPrefix: "THL-FRG-OUD",
    image: IMAGES.coord,
    description:
      "An in-house oud blended with saffron and cedar, bottled in Ahmedabad. Launched alongside the boutique's bespoke service.",
    category: "accessory",
    gender: "unisex",
  },
];

/**
 * Real parcel data per product so Shiprocket is never handed one universal box and GST
 * invoices can carry a category-correct HSN (GAP-TAX-04 / GAP-LOG-02).
 */
function packageMetadata(category: string | undefined): Record<string, number> {
  const dims = PACKAGE_BY_CATEGORY[category ?? "ready_to_wear"] ?? PACKAGE_BY_CATEGORY.ready_to_wear;
  return {
    package_length_cm: dims.length,
    package_breadth_cm: dims.breadth,
    package_height_cm: dims.height,
  };
}

function packageWeightGrams(category: string | undefined): number {
  const dims = PACKAGE_BY_CATEGORY[category ?? "ready_to_wear"] ?? PACKAGE_BY_CATEGORY.ready_to_wear;
  return Math.round(dims.weight * 1000);
}

/** Stocked quantity per size index; the final size of each product is deliberately empty. */
function stockForSize(index: number, total: number): number {
  // A single-size product (sunglasses, one-size accessories) must still be purchasable.
  if (total === 1) return 3;
  if (index === total - 1) return 0;
  return [4, 6, 2, 3, 5][index % 5] ?? 3;
}

const PAGES = [
  {
    slug: "policies/shipping",
    kind: "policy",
    title: "Shipping",
    body: `## Delivery within India\n\nStandard delivery is complimentary on every order and arrives in 3–6 working days. Express delivery is available at checkout for ₹199 and arrives in 1–2 working days in serviceable pincodes.\n\n## Dispatch\n\nOrders placed before 2pm IST on a working day are packed the same day. Every shipment is trackable from your account.\n\n## Serviceability\n\nWe currently ship within India only. We ship to most pincodes across India.`,
  },
  {
    slug: "policies/returns",
    kind: "policy",
    title: "Returns & refunds",
    body: `## 7-day returns\n\nYou may request a return within 7 days of delivery if the item is unworn, with its original box and tags. Final-sale items and intimate apparel are not returnable.\n\n## How it works\n\nOpen the order in your account and choose Return. We arrange a reverse pickup. Once the item is received and inspected, the refund is issued to the original payment method within 5–7 working days.\n\n## Refund amount\n\nThe refund is based on the price you paid, not the current product price. Shipping charges are refunded only when the return is due to a fault on our side.`,
  },
  {
    slug: "policies/privacy",
    kind: "policy",
    title: "Privacy",
    body: `## What we collect\n\nYour account details, order and delivery information, and the technical logs needed to run the store securely.\n\n## What we do not do\n\nWe do not sell personal data. We do not store card details on our servers; payments are processed by our payment provider.\n\n## Your choices\n\nYou can request a copy of your data or its deletion by contacting support. Order records are retained where the law requires it.`,
  },
  {
    slug: "policies/terms",
    kind: "policy",
    title: "Terms of service",
    body: `## Using this store\n\nYou must provide accurate account and delivery information. Prices are shown in INR and include applicable taxes unless stated otherwise.\n\n## Orders\n\nAn order is accepted when payment is verified and the confirmation is shown. We may cancel an order if stock is unavailable; any captured amount is refunded in full.\n\n## Authenticity\n\nEvery item we sell is sourced through our own buying process. We describe condition and provenance using the information we actually hold.`,
  },
  {
    slug: "about",
    kind: "page",
    title: "About The Hidden Label",
    body: `## A retailer, not a marketplace\n\nWe buy, hold and ship every item ourselves. One retailer, many brands — no third-party sellers, no drop-shipping.\n\n## How we buy\n\nOur buying team works directly with brand accounts and authorised distributors. Each pair is checked on arrival for condition, box and labelling before it is listed.\n\n## Where we are\n\nMumbai, India. Orders ship nationwide from our own warehouse.`,
  },
  {
    slug: "support",
    kind: "faq",
    title: "Support",
    body: `## Order help\n\nFor an order in progress, open it from your account and use the contact options there. Include your order number so we can find it quickly.\n\n## Size help\n\nOur size guide lists UK, EU and CM conversions. If you are between sizes, take the larger size in Nike and Jordan and your usual size in adidas.\n\n## Response times\n\nWe answer within one working day, Monday to Saturday, 10am–7pm IST.`,
  },
  {
    slug: "size-guide",
    kind: "page",
    title: "Size guide",
    body: `## Footwear conversions\n\n| UK | EU | US Men | CM |\n| --- | --- | --- | --- |\n| 6 | 40 | 7 | 25 |\n| 7 | 41 | 8 | 26 |\n| 8 | 42.5 | 9 | 27 |\n| 9 | 44 | 10 | 28 |\n| 10 | 45 | 11 | 29 |\n| 11 | 46 | 12 | 30 |\n\n## Measuring\n\nStand on a sheet of paper, mark the longest toe and the heel, and measure the distance in centimetres. Measure both feet and use the larger figure.`,
  },
  {
    slug: "authenticity",
    kind: "page",
    title: "How we check every pair",
    body: `## Our process\n\nEvery pair is inspected on arrival: box labelling, size tags, stitching, sole tooling and material feel. Anything that does not match the brand's own reference is returned to the supplier and never listed.\n\n## What we do not claim\n\nWe do not operate an RFID or serialised certificate programme, and we do not display a "verified authentic" badge. Our claim is the process described above, nothing more.\n\n## If something is wrong\n\nContact support within 7 days of delivery. If an inspection finds a fault, we refund in full and cover return shipping.`,
  },
];

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database.");
  }

  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const regionService = container.resolve(Modules.REGION);
  const apiKeyService = container.resolve(Modules.API_KEY);
  const productService = container.resolve(Modules.PRODUCT);
  const inventoryService = container.resolve(Modules.INVENTORY);
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);
  const fulfillmentService = container.resolve(Modules.FULFILLMENT);

  const thl = container.resolve<ThlModuleService>(THL_MODULE);

  /* --- Sales channel ---------------------------------------------------- */
  const existingChannels = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  });
  const salesChannel =
    existingChannels[0] ??
    (
      await createSalesChannelsWorkflow(container).run({
        input: {
          salesChannelsData: [
            { name: "Default Sales Channel", description: "The Hidden Label storefront" },
          ],
        },
      })
    ).result[0];

  /* --- Region ----------------------------------------------------------- */
  // Prepaid only: UPI and cards through Razorpay. Cash on Delivery (pp_system_default) is
  // deliberately NOT linked to the India region, so the store API can never offer it. The
  // provider is linked only once real keys exist; an unconfigured environment offers no
  // payment method rather than one it cannot process.
  const regionPaymentProviders = process.env.RAZORPAY_KEY_ID ? ["pp_razorpay_razorpay"] : [];

  const existingRegions = await regionService.listRegions({ currency_code: "inr" });
  if (existingRegions.length === 0) {
    await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "India",
            currency_code: "inr",
            countries: ["in"],
            payment_providers: regionPaymentProviders,
          },
        ],
      },
    });
    logger.info("region created: India (INR)");
  }

  /* --- GST tax configuration (GAP-TAX-01) ------------------------------- */
  // Medusa ships with empty tax tables; without this every cart records tax_total = 0.
  // `pnpm db:setup-tax` runs the same idempotent helper on production, where seed.ts refuses.
  const tax = await ensureIndiaTaxSetup(pg);
  logger.info(
    `India GST region ready: ${tax.regionId} (created ${tax.createdRates.length}, existing ${tax.existingRates.length})`,
  );

  /* --- Publishable key -------------------------------------------------- */
  const existingKeys = await apiKeyService.listApiKeys({ type: "publishable" });
  let publishableToken = existingKeys[0]?.token;

  if (!publishableToken) {
    const created = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: "Storefront", type: "publishable", created_by: "seed" }],
      },
    });
    const key = created.result[0];
    publishableToken = key?.token;

    if (key && salesChannel) {
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: key.id, add: [salesChannel.id] },
      });
    }
  }

  /* --- Stock location --------------------------------------------------- */
  let stockLocation = (await stockLocationService.listStockLocations({}, { take: 1 }))[0];
  if (!stockLocation) {
    const createdLocation = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "The Hidden Label Warehouse",
            address: { address_1: "—", city: "Mumbai", country_code: "in" },
          },
        ],
      },
    });
    stockLocation = createdLocation.result[0];
    logger.info(`stock location created: ${stockLocation?.id ?? "none"}`);
  }

  if (stockLocation && salesChannel) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    });
  }

  // Captured from the fulfillment setup below and reused when creating products: a product
  // whose variants have no shipping_profile_id cannot be shipped with these options
  // (`createProductsWorkflow` leaves it unset unless given one explicitly), which surfaces only
  // at checkout as "cart items require shipping profiles that are not satisfied" — see
  // docs/BUILD_LOG.md.
  let shippingProfileId: string | null = null;

  /*
   * Enable the manual fulfillment provider at the stock location. Medusa 2.22.7 refuses to
   * create a shipping option for a provider that is not explicitly linked to the location
   * (`validateFulfillmentProvidersStep`, core-flows) — the same link the admin's
   * "enable providers" screen (`POST /admin/stock-locations/:id/fulfillment-providers`) creates.
   * There is no dedicated seed-time workflow for it, so this replicates that route's own
   * `batchLinksWorkflow` call directly.
   */
  if (stockLocation) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: locationsWithProviders } = await query.graph({
      entity: "stock_location",
      fields: ["id", "fulfillment_providers.id"],
      filters: { id: stockLocation.id },
    });
    const rawProviders: unknown[] = locationsWithProviders[0]?.fulfillment_providers ?? [];
    const enabledProviderIds = rawProviders
      .filter((provider: unknown): provider is { id: string } => Boolean(provider))
      .map((provider: { id: string }) => provider.id);

    if (!enabledProviderIds.includes("manual_manual")) {
      await batchLinksWorkflow(container).run({
        input: {
          create: [
            {
              [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
              [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
            },
          ],
        },
      });
      logger.info("fulfillment provider enabled: manual_manual");
    }
  }

  /* --- Fulfilment set + service zone + shipping options ----------------- */
  if (stockLocation) {
    const sets = await fulfillmentService.listFulfillmentSets(
      { name: "The Hidden Label Shipping" },
      { take: 1 },
    );

    if (sets.length === 0) {
      await createLocationFulfillmentSetWorkflow(container).run({
        input: {
          location_id: stockLocation.id,
          fulfillment_set_data: { name: "The Hidden Label Shipping", type: "shipping" },
        },
      });
      logger.info("fulfillment set created");
    }

    const fulfillmentSet = (
      await fulfillmentService.listFulfillmentSets(
        { name: "The Hidden Label Shipping" },
        { take: 1 },
      )
    )[0];

    if (fulfillmentSet) {
      const allZones = await fulfillmentService.listServiceZones({}, { take: 50 });
      const zones = allZones.filter(
        (zone) => zone.fulfillment_set_id === fulfillmentSet.id,
      );

      if (zones.length === 0) {
        await createServiceZonesWorkflow(container).run({
          input: {
            data: [
              {
                fulfillment_set_id: fulfillmentSet.id,
                name: "India",
                geo_zones: [{ type: "country", country_code: "in" }],
              },
            ],
          },
        });
        logger.info("service zone created: India");
      }

      const refreshedZones = await fulfillmentService.listServiceZones({}, { take: 50 });
      const serviceZone = refreshedZones.find(
        (zone) => zone.fulfillment_set_id === fulfillmentSet.id,
      );

      const profile = await pg("shipping_profile").first("id");
      shippingProfileId = profile?.id ?? null;

      if (serviceZone && profile) {
        const allOptions = await fulfillmentService.listShippingOptions({}, { take: 50 });
        const options = allOptions.filter((option) => option.service_zone_id === serviceZone.id);

        if (options.length === 0) {
          await createShippingOptionsWorkflow(container).run({
            input: [
              {
                name: "Standard delivery",
                service_zone_id: serviceZone.id,
                shipping_profile_id: profile.id,
                provider_id: "manual_manual",
                price_type: "flat",
                type: { label: "Standard", description: "3–6 working days", code: "standard" },
                prices: [{ currency_code: "inr", amount: 0 }],
                rules: [
                  { attribute: "enabled_in_store", value: "true", operator: "eq" },
                  { attribute: "is_return", value: "false", operator: "eq" },
                ],
              },
              {
                name: "Express delivery",
                service_zone_id: serviceZone.id,
                shipping_profile_id: profile.id,
                provider_id: "manual_manual",
                price_type: "flat",
                type: { label: "Express", description: "1–2 working days", code: "express" },
                // Amounts here are rupees, same convention as product prices (see
                // `priceRupees` below) — not paise. ₹199 matches the shipping policy copy in
                // PAGES (docs/BUILD_LOG.md: this was previously 19900, i.e. ₹19,900).
                prices: [{ currency_code: "inr", amount: 199 }],
                rules: [
                  { attribute: "enabled_in_store", value: "true", operator: "eq" },
                  { attribute: "is_return", value: "false", operator: "eq" },
                ],
              },
            ],
          });
          logger.info("shipping options created: standard (free), express (₹199)");
        }
      }
    }
  }

  /* --- Brands ----------------------------------------------------------- */
  // Raw knex inserts bypass the DML model's own id generation, so the id is generated here
  // exactly as Medusa's model factory would (ulid with the model's prefix) — the `brand` table
  // has no DB-level default for `id`.
  for (const brand of BRANDS) {
    await pg("brand")
      .insert({
        id: generateEntityId(undefined, "brand"),
        handle: brand.handle,
        name: brand.name,
        tagline: brand.tagline,
        description: brand.description,
        partnership_tier: brand.tier,
        country: brand.country,
        is_active: true,
        sort_order: brand.sortOrder,
        metadata: JSON.stringify({ seeded: true }),
      })
      .onConflict("handle")
      .merge([
        "name",
        "tagline",
        "description",
        "partnership_tier",
        "country",
        "is_active",
        "sort_order",
      ]);
  }
  const brandRows = await pg("brand").select("id", "handle");
  const brandByHandle = new Map(brandRows.map((row) => [row.handle, row.id]));
  logger.info(`brands: ${brandRows.length}`);

  /* --- Categories --------------------------------------------------------- */
  const existingCategoryRows = await pg("product_category")
    .whereNull("deleted_at")
    .select("id", "handle");
  const categoryIdByHandle = new Map(existingCategoryRows.map((row) => [row.handle, row.id]));

  for (const category of CATEGORY_TREE) {
    if (categoryIdByHandle.has(category.handle)) continue;
    // Parents are listed before children in CATEGORY_TREE, so the parent id is always already
    // in the map by the time a child is created.
    const parentId = category.parentHandle ? categoryIdByHandle.get(category.parentHandle) : null;
    const createdCategory = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name: category.name,
            handle: category.handle,
            is_active: true,
            ...(parentId ? { parent_category_id: parentId } : {}),
          },
        ],
      },
    });
    const newId = createdCategory.result[0]?.id;
    if (newId) categoryIdByHandle.set(category.handle, newId);
  }
  logger.info(`categories: ${categoryIdByHandle.size}`);

  /* --- Products --------------------------------------------------------- */
  const existingProducts = await productService.listProducts(
    { handle: PRODUCTS.map((product) => product.handle) },
    { select: ["id", "handle"] },
  );
  const existingHandles = new Set(existingProducts.map((p) => p.handle));
  logger.info(`found ${existingProducts.length} already existing product(s)`);

  for (const product of existingProducts) {
    const pConfig = PRODUCTS.find((p) => p.handle === product.handle);
    const brandId = pConfig ? brandByHandle.get(pConfig.brand) : null;
    if (brandId) {
      await pg("product_brand")
        .insert({ product_id: product.id, brand_id: brandId })
        .onConflict(["product_id", "brand_id"])
        .ignore();
    }
    if (pConfig) {
      for (const handle of categoryHandlesFor(pConfig)) {
        const categoryId = categoryIdByHandle.get(handle);
        if (!categoryId) continue;
        await pg("product_category_product")
          .insert({ product_id: product.id, product_category_id: categoryId })
          .onConflict(["product_id", "product_category_id"])
          .ignore();
      }
    }
  }

  const productsToCreate = PRODUCTS.filter((p) => !existingHandles.has(p.handle));

  for (const product of productsToCreate) {
    const inventoryLinks: { inventory_item_id: string; required_quantity: number; sku: string }[] =
      [];

    for (const [index, size] of product.sizes.entries()) {
      const sku = `${product.skuPrefix}-${index + 1}`;
      const existingItem = (await inventoryService.listInventoryItems({ sku }, { take: 1 }))[0];
      let inventoryItemId = existingItem?.id;

      if (!inventoryItemId) {
        const createdItem = await createInventoryItemsWorkflow(container).run({
          input: {
            items: [{ sku, title: `${product.title} — ${size}`, requires_shipping: true }],
          },
        });
        inventoryItemId = createdItem.result[0]?.id;
      }

      if (!inventoryItemId) continue;

      if (stockLocation) {
        const levels = await inventoryService.listInventoryLevels(
          { inventory_item_id: inventoryItemId, location_id: stockLocation.id },
          { take: 1 },
        );
        if (levels.length === 0) {
          await createInventoryLevelsWorkflow(container).run({
            input: {
              inventory_levels: [
                {
                  inventory_item_id: inventoryItemId,
                  location_id: stockLocation.id,
                  stocked_quantity: stockForSize(index, product.sizes.length),
                },
              ],
            },
          });
        }
      }

      inventoryLinks.push({ inventory_item_id: inventoryItemId, required_quantity: 1, sku });
    }

    const created = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: product.title,
            handle: product.handle,
            description: product.description,
            status: ProductStatus.PUBLISHED,
            weight: packageWeightGrams(product.category),
            thumbnail: product.image,
            images: [{ url: product.image }],
            metadata: {
              brand: BRANDS.find((b) => b.handle === product.brand)?.name ?? null,
              category: product.category ?? "footwear",
              ...(product.gender ? { gender: product.gender } : {}),
              ...(product.bespoke ? { bespoke: true } : {}),
              hsn: hsnForProduct({
                title: product.title,
                category: product.category,
                gender: product.gender,
              }),
              country_of_origin: "India",
              ...packageMetadata(product.category),
            },
            ...(shippingProfileId ? { shipping_profile_id: shippingProfileId } : {}),
            category_ids: categoryHandlesFor(product)
              .map((handle) => categoryIdByHandle.get(handle))
              .filter((id): id is string => Boolean(id)),
            options: [{ title: "Size", values: product.sizes }],
            variants: product.sizes.map((size, index) => ({
              title: size,
              sku: inventoryLinks[index]?.sku,
              options: { Size: size },
              manage_inventory: true,
              inventory_items: [
                {
                  inventory_item_id: inventoryLinks[index]?.inventory_item_id ?? "",
                  required_quantity: 1,
                },
              ],
              prices: [{ amount: product.priceRupees, currency_code: "inr" }],
            })),
            ...(salesChannel ? { sales_channels: [{ id: salesChannel.id }] } : {}),
          },
        ],
      },
    });

    const productId = created.result[0]?.id;
    const brandId = brandByHandle.get(product.brand);
    if (productId && brandId) {
      await pg("product_brand")
        .insert({ product_id: productId, brand_id: brandId })
        .onConflict(["product_id", "brand_id"])
        .ignore();
    }

    logger.info(`product created: ${product.handle}`);
  }

  /* --- CMS pages -------------------------------------------------------- */
  for (const page of PAGES) {
    await pg("cms_page")
      .insert({
        id: generateEntityId(undefined, "cms"),
        slug: page.slug,
        kind: page.kind,
        title: page.title,
        body_md: page.body,
        is_published: true,
        published_at: new Date(),
        blocks: JSON.stringify([]),
      })
      .onConflict("slug")
      .merge(["kind", "title", "body_md", "is_published", "blocks"]);
  }
  logger.info(`cms pages: ${PAGES.length}`);

  /* --- Banner slots ----------------------------------------------------- */
  const homePage = await pg("cms_page").where({ slug: "about" }).first();
  const banners = await pg("banner_slot").select("id").limit(1);
  if (banners.length === 0) {
    await pg("banner_slot").insert([
      {
        id: generateEntityId(undefined, "ban"),
        placement: "home.hero",
        page_id: homePage?.id ?? null,
        image_url: IMAGES.jordan1,
        headline: "Archive pieces, kept in plain sight.",
        subhead:
          "A tight edit of footwear from the houses worth queuing for. Sourced, checked and priced in INR.",
        cta_label: "Shop all",
        cta_href: "/collections/all",
        is_active: true,
        sort_order: 0,
      },
      {
        id: generateEntityId(undefined, "ban"),
        placement: "home.secondary",
        page_id: null,
        image_url: IMAGES.salomon,
        headline: "Trail, then pavement.",
        subhead: "Salomon XT-6 back in stock in vanilla ice.",
        cta_label: "View brand",
        cta_href: "/brands/salomon",
        is_active: true,
        sort_order: 1,
      },
    ]);
    logger.info("banner slots created");
  }

  /* --- Ensure the thl service can read its tables ----------------------- */
  const brandCount = await thl.listBrands({}, { take: 1 });
  logger.info(`thl brand module responding: ${brandCount.length >= 0 ? "yes" : "yes"}`);

  logger.info("─".repeat(60));
  if (publishableToken) {
    logger.info("Storefront publishable key (put this in the storefront env):");
    logger.info(`MEDUSA_PUBLISHABLE_KEY=${publishableToken}`);
  }
  logger.info("Seed complete.");
}
