import { computeInclusiveGst } from "../packages/shared/src/gst.ts";

for (const buyerState of ["Gujarat", "Maharashtra"]) {
  const gst = computeInclusiveGst({
    totalInclusive: 2948820 as never,
    sellerStateCode: "24",
    buyerState,
    actualTaxTotal: null as never,
  });
  console.log(buyerState, JSON.stringify(gst));
}
