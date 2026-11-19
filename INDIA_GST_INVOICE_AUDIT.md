# THE HIDDEN LABEL — INDIA-SPECIFIC COMMERCE, GST & INVOICING AUDIT
**Investigation of Goods & Services Tax (GST) Architecture, Invoicing Compliance, HSN Classification, and Place-of-Supply Logic**

---

## 1. Executive Summary & Operational Verdict

### **VERDICT: ⛔ CRITICALLY NON-COMPLIANT / REGULATORY RELEASE BLOCKER**

> [!CAUTION]
> 1. **Zero Database Tax Engine:** All Medusa tax tables (`tax_region`, `tax_rate`, `tax_rate_rule`, `order_line_item_tax_line`, `cart_line_item_tax_line`) contain **EXACTLY 0 ROWS**. The commerce engine computes zero tax at checkout; orders, carts, and payments record gross totals equal to net totals.
> 2. **Illegal Inter-State Tax Billing:** The printable invoice template (`apps/storefront/app/account/orders/[id]/invoice/page.tsx`) **hardcodes CGST (9%) + SGST (9%) and State Code 24 (Gujarat) for ALL orders nationwide**, billing local intra-state taxes to customers in Maharashtra, Delhi, or Karnataka. This violates Section 7 and Section 8 of the Integrated Goods and Services Tax (IGST) Act, 2017.
> 3. **Synthetic Dummy GSTIN:** The invoice displays a hardcoded dummy GSTIN (`24AAACT1234F1Z5`), failing to source an authentic registered entity GSTIN from environment configuration.
> 4. **Uniform HSN Misclassification:** The invoice template hardcodes `HSN Code: 6403 (Footwear)` across all goods, including luxury menswear, silk dresses, tailoring, and leather accessories.

---

## 2. Medusa Database Tax Engine Audit

We queried PostgreSQL table row counts across all tax-related tables in the database:

```
Table: tax_region                    -> 0 rows
Table: tax_rate                      -> 0 rows
Table: tax_rate_rule                 -> 0 rows
Table: tax_provider                  -> 1 row (system tax provider)
Table: order_line_item_tax_line      -> 0 rows
Table: order_shipping_method_tax_line-> 0 rows
Table: cart_line_item_tax_line       -> 0 rows
Table: cart_shipping_method_tax_line -> 0 rows
```

### Analysis of Commerce Tax Disconnection:
- **At Browse & PDP:** Product prices in database (e.g., ₹24,000 for Fear of God hoodie) are treated as tax-agnostic flat amounts.
- **At Bag & Checkout:** Medusa's tax calculation step executes against empty tax regions, adding `₹0.00` tax line items.
- **At Payment:** Carts are authorized for the raw merchandise subtotal + shipping fee, with `tax_total = 0`.
- **At Order Commitment:** The `order` table in PostgreSQL records `tax_total = 0` on every single order row.

---

## 3. Invoice Template Inspection & Statutory GST Violations

We performed a line-by-line inspection of `apps/storefront/app/account/orders/[id]/invoice/page.tsx`:

### 3.1. Artificial Client-Side Tax Reverse Calculation
In lines 37–41:
```typescript
// Calculate GST components (assumes 18% inclusive GST for luxury apparel/footwear)
const taxableAmount = Math.round((order.total / 1.18) * 100) / 100;
const totalTax = Math.round((order.total - taxableAmount) * 100) / 100;
const cgst = Math.round((totalTax / 2) * 100) / 100;
const sgst = Math.round((totalTax - cgst) * 100) / 100;
```
- **Finding:** Tax is not retrieved from immutable order line records; it is computed entirely on-the-fly inside the Next.js React component by dividing by 1.18.
- **Risk:** If tax slabs vary across items (e.g. 12% for apparel under ₹1,000, 18% for luxury goods, 28% for certain synthetic accessories), the invoice fabricates a flat 18% inclusive split.

### 3.2. Violation of Inter-State IGST Mandate
In lines 105 and 150–153:
```tsx
Place of Supply: {addr?.province ?? "Gujarat"} (State Code: 24)
...
<p className="font-mono text-label-caps uppercase font-semibold text-ink mb-1">Tax Summary (18% GST)</p>
<p>Taxable Value: ₹{taxableAmount.toLocaleString("en-IN")}</p>
<p>CGST (9.0%): ₹{cgst.toLocaleString("en-IN")}</p>
<p>SGST (9.0%): ₹{sgst.toLocaleString("en-IN")}</p>
```
- **Statutory Law:** Under Indian GST legislation:
  - When the supplier state (Gujarat, Code 24) matches the place of supply (customer destination state): Tax must be split into **Central GST (CGST 9%) + State GST (SGST 9%)**.
  - When the supplier state differs from the place of supply (e.g., parcel shipped to Maharashtra, Delhi, Haryana, Karnataka): Tax must be billed exclusively as **Integrated GST (IGST 18%)**.
- **Violation:** The invoice charges CGST (Gujarat) and SGST (Gujarat) on shipments delivered to customers outside Gujarat. Claiming Gujarat State GST on inter-state shipments is legally invalid, prevents corporate B2B customers from claiming Input Tax Credit (ITC), and exposes the business to tax penalties.

### 3.3. Dummy GSTIN & Legal Entity Discrepancy
In line 67:
```tsx
<strong>GSTIN:</strong> 24AAACT1234F1Z5<br />
```
- **Audit Finding:** `24AAACT1234F1Z5` is a synthetic dummy identifier (PAN structure `AAACT1234F` is invalid).
- **Discrepancy:** In `REMEDIATION_REPORT.md` (BUG-020, line 221), engineering documented that the invoice displays official GSTIN `27AABCU9603R1ZM`. In actual code, the file still contains the hardcoded dummy string `24AAACT1234F1Z5`.

### 3.4. Uniform Hardcoded HSN Code
In line 133:
```tsx
<td className="py-3 px-3 font-mono">6403 (Footwear)</td>
```
- **Audit Finding:** The table hardcodes `6403 (Footwear)` across all items.
- **Regulatory Reality:** Indian GST mandates specific Harmonized System of Nomenclature (HSN) codes:
  - Footwear with leather outer soles: **HSN 6403**
  - Footwear with rubber/plastics: **HSN 6402**
  - Men's Suits, Ensembles, Jackets, Trousers (Woven): **HSN 6203**
  - Women's Suits, Ensembles, Dresses (Woven): **HSN 6204**
  - T-Shirts, Singlets, Tank Tops (Knitted): **HSN 6109**
  - Trunks, Suitcases, Handbags: **HSN 4202**
- Applying Footwear HSN to high-value woven suits and luxury apparel is a direct misclassification violation under Section 122 of the CGST Act.

### 3.5. Hardcoded Payment Method
In line 78:
```tsx
<p className="font-mono text-xs text-muted"><strong>Payment Mode:</strong> Cash on Delivery / Offline</p>
```
- Even if a customer pays online via UPI, Net Banking, or Credit Card, the invoice states "Cash on Delivery / Offline".

---

## 4. Invoicing Architecture & Statutory Gaps

| Mandatory GST Invoicing Rule (Rule 46, CGST Rules) | Required Compliance | THE HIDDEN LABEL Current Code | Compliance Verdict |
|---|---|---|---|
| **Name, Address & GSTIN of Supplier** | Registered entity details | Hardcoded dummy GSTIN (`24AAACT1234F1Z5`) | ❌ **NON-COMPLIANT** |
| **Consecutive Serial Invoice Number** | Unique, sequential, not exceeding 16 characters, financial year specific | Generated on-the-fly (`INV-THL-${order.display_id}`); no persistence | ⚠️ **PARTIAL RISK** |
| **Date of its Issue** | Real invoice issuance timestamp | Formats order creation date | ✅ **COMPLIANT** |
| **Name, Address & GSTIN (if registered) of Recipient**| Complete buyer details with optional B2B GSTIN | Renders name/address; **No B2B GSTIN field** | ⚠️ **PARTIAL (B2C Only)**|
| **Place of Supply & State Name/Code** | Mandatory on inter-state deliveries | Hardcodes Gujarat (Code 24) for all destinations | ❌ **NON-COMPLIANT** |
| **HSN Code of Goods** | 4-digit (turnover < ₹5 Cr) or 6-digit (turnover > ₹5 Cr) | Hardcodes `6403` for all items | ❌ **NON-COMPLIANT** |
| **Taxable Value & Applicable Tax Rates** | Line-item taxable value, CGST/SGST or IGST | Computed by client-side math; zero in DB | ❌ **NON-COMPLIANT** |
| **Signature / Digital Signature** | Digital signature of authorized signatory | Text: "Computer generated... No signature required" | ⚠️ **CONDITIONAL** |

---

## 5. Required Remediation for GST Tax Compliance

1. **Seed Indian GST Tax Configuration in Medusa:**
   - Seed `tax_region` for India (`IN`) and Gujarat (`IN-GJ`).
   - Seed `tax_rate` for standard Indian slabs (5%, 12%, 18%, 28%).
   - Configure tax rules to calculate taxes dynamically in cart line items and order totals.
2. **Environment-Driven Registered Business GSTIN:**
   - Expose `BUSINESS_GSTIN` and `BUSINESS_STATE_CODE` in `.env`.
3. **Implement Place-of-Supply Engine:**
   - In invoice generation, compare customer shipping state code against supplier state code (24):
     - If shipping state == 24: CGST (9%) + SGST (9%).
     - If shipping state != 24: IGST (18%).
4. **Dynamic HSN Classification:**
   - Map HSN codes to product categories in Medusa product metadata (e.g. `metadata.hsn_code`).
5. **Display Real Payment Mode:**
   - Read actual payment provider from `order.payments` instead of hardcoding Cash on Delivery.
