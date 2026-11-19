# THE HIDDEN LABEL — CUSTOMER SUPPORT & COMMUNICATION AUDIT
**Detailed Investigation of Support Channels, Complaint Handling, Escalation Workflows, and Statutory Grievance Redressal**

---

## 1. Executive Summary & Operational Verdict

### **VERDICT: ⛔ STATIC FAQ ONLY — ZERO OPERATIONAL CUSTOMER SUPPORT INFRASTRUCTURE**

> [!CAUTION]
> The platform provides **no functional customer support channels**.
> 1. The `/support` page is a static CMS FAQ renderer with three generic text paragraphs.
> 2. There is **no contact form, no ticketing system, no support email receiver, no customer support phone number, and no WhatsApp integration**.
> 3. There are **no published Grievance Officer details**, violating mandatory statutory requirements under the Indian Consumer Protection (E-Commerce) Rules, 2020.
> 4. Customer inquiries regarding delayed shipments, payment failures, or damaged goods have **no working destination** within the application.

---

## 2. Support Channels & Communication Touchpoints Audit

| Support Channel / Feature | Statutory / Business Requirement | Current Repository Status | Code File / Route | Actual Runtime Behavior |
|---|---|---|---|---|
| **Support Page** | Central help & contact hub | ⚠️ Static FAQ Only | `apps/storefront/app/support/page.tsx` | Renders 3 static markdown paragraphs from `cms_page` (`slug: "support"`). |
| **Interactive Contact Form** | Submit inquiry with name, email, order ID, issue | ❌ **NOT IMPLEMENTED** | None | Zero contact forms exist on the storefront. |
| **Support Email Channel** | Inbound support inbox (`support@...` or `orders@...`) | ⚠️ Unmonitored mention | Mentioned in seed text | Mentioned as plain text in footer/policies; no email intake or helpdesk integration. |
| **Inbound Phone Support** | Direct telephone line for urgent inquiries | ❌ **NOT IMPLEMENTED** | None | No phone number published anywhere on the website. |
| **Helpdesk Ticketing System**| Ticket creation, assignment, tracking, and SLA | ❌ **NOT IMPLEMENTED** | None | Zero ticketing models, tables, or APIs exist in backend or admin. |
| **Order-Specific Support** | One-click inquiry from `/account/orders/:id` | ❌ **NOT IMPLEMENTED** | `app/account/orders/[id]/page.tsx` | Order detail page contains Cancel, Return, and Invoice buttons; **zero support contact CTA**. |
| **WhatsApp Luxury Concierge**| Direct chat with stylist / support on WhatsApp | ❌ **NOT IMPLEMENTED** | None | Mentioned in architecture docs; **zero `wa.me` links or WhatsApp Business API code**. |
| **Live Chat Widget** | Real-time chat widget on storefront | ⚠️ Style Concierge Only | `app/storefront/components/concierge-fab.tsx` | Floating AI concierge answers styling questions via Gemini; **cannot handle order issues or customer support**. |
| **Grievance Officer Details**| Statutory officer name, email, phone, address | ❌ **NOT IMPLEMENTED** | None | **Completely absent from the website**. |

---

## 3. Analysis of the `/support` Page & Seed Data

In `apps/backend/src/scripts/seed.ts` (lines 462–466), the entire support configuration of the website consists of:
```markdown
## Order help
For an order in progress, open it from your account and use the contact options there. Include your order number so we can find it quickly.

## Size help
Our size guide lists UK, EU and CM conversions. If you are between sizes, take the larger size in Nike and Jordan and your usual size in adidas.

## Response times
We answer within one working day, Monday to Saturday, 10am–7pm IST.
```

### Critical Operational Disconnect:
The seeded text instructs customers: *"For an order in progress, open it from your account and use the contact options there."*
However, when an authenticated customer navigates to `/account/orders/:id`, **there are NO contact options**. The page solely renders order line items and shipment tracking pills. A customer seeking help with an active order has no mechanism to message support, open a ticket, or reach an agent.

---

## 4. Indian Statutory Compliance Audit (Consumer Protection E-Commerce Rules, 2020)

Under Rule 4, Rule 5, and Rule 6 of the Consumer Protection (E-Commerce) Rules, 2020 (notified under the Consumer Protection Act, 2019), every e-commerce entity operating in India is legally mandated to establish a structured grievance redressal mechanism:

| Statutory Requirement | Legal Rule Reference | Platform Status | Compliance Verdict |
|---|---|---|---|
| **Prominent Publication of Grievance Officer** | Rule 4(4) | Absent on all pages | ❌ **ILLEGAL / NON-COMPLIANT** |
| **Name, Designation & Direct Contact of Grievance Officer** | Rule 4(4) | Absent on all pages | ❌ **ILLEGAL / NON-COMPLIANT** |
| **Complaint Acknowledgment within 48 Hours** | Rule 4(5) | No ticketing system exists | ❌ **NON-COMPLIANT** |
| **Complaint Redressal within 1 Month** | Rule 4(5) | No ticketing system exists | ❌ **NON-COMPLIANT** |
| **Ticket / Reference Number Issuance** | Rule 4(5) | No ticketing system exists | ❌ **NON-COMPLIANT** |
| **Convergence with National Consumer Helpline (NCH)**| Ministry of Consumer Affairs Directive | Absent | ❌ **NON-COMPLIANT** |

---

## 5. Style Concierge vs. Customer Support Distinction

The repository includes an AI-powered conversational Style Concierge:
- **Files:** `apps/backend/src/api/store/concierge/chat/route.ts` and `apps/storefront/components/concierge-fab.tsx`.
- **Purpose:** Styling advice, silhouette recommendations, and catalog discovery powered by Google Gemini.
- **Evaluation:**
  - The Style Concierge **cannot and must not be treated as a customer support system**.
  - It does not have access to customer order status, shipping carrier tracking, payment collection records, or return approvals.
  - Prompt instructions in `apps/backend/src/lib/gemini.ts` explicitly forbid the AI model from making factual claims about order fulfillment or physical inspection.
  - Relying on this AI concierge for operational disputes will result in automated hallucinations and severe customer dissatisfaction.

---

## 6. Required Remediation for Customer Support Infrastructure

1. **Publish Statutory Grievance Redressal Notice:**
   - Create `/policies/grievance` and update website footer with:
     - Name of Grievance Officer (e.g., *Head of Client Services*).
     - Official Email: `grievance@thehiddenlabel.com`.
     - Direct Telephone: Dedicated Indian landline / mobile.
     - Registered Physical Address: Sindhu Bhavan Road, Bodakdev, Ahmedabad, Gujarat 380054.
     - Explicit commitment: Acknowledgment within 48 hours; resolution within 30 days.
2. **Build Interactive Support Contact Form:**
   - Create `/contact` and `/account/orders/:id/help` allowing customers to select an order, choose an issue category (Delivery Delay, Damaged Parcel, Size Exchange, Payment Query), and submit a message with file attachments.
3. **Integrate Real Helpdesk API (Zendesk / Freshdesk / Custom Medusa Module):**
   - Ingest inquiries as structured tickets with sequential ticket numbers (`TKT-THL-XXXXX`).
   - Allow administrative staff in `/admin` to reply to tickets, with automated email updates dispatched to customers.
4. **Deploy WhatsApp Support Concierge:**
   - Integrate a direct `https://wa.me/91XXXXXXXXXX?text=Hi%20The%20Hidden%20Label...` floating button for instantaneous white-glove client support.
