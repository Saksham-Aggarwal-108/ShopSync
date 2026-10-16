# ShopSync — Phase 2: UI/UX Design & Prototype Specification

> **"Your Shop. Online. In Control."**  
> *A balanced, resilient digital storefront and operational cockpit designed for independent neighbourhood shops.*

---

## 1. Prototype Overview

Phase 2 delivers a functional, responsive, and aesthetically refined prototype of **ShopSync**. The platform provides an operational equilibrium: customer convenience without shopkeeper overwhelm.

### Key Capabilities Delivered:
1. **Public Storefront (`/`)**:
   - Modern brand identity with small-business aesthetic (emerald, warm amber, cream surface, crisp typography).
   - Real-time stock transparency badges: `In Stock`, `Low Stock`, and `Sold Out`.
   - Inventory audit transparency: Displays physical audit timestamp (*"Verified today"*).
   - Category filtering & search.
   - Interactive cart drawer with fulfilment method switcher (*In-Store Pickup* vs. *Local Delivery*).
   - Dynamic Daily Fulfilment Capacity indicator.
   - Master order pause awareness: When the shopkeeper pauses orders, customers are shown a friendly banner while browsing and enquiries remain 100% open.

2. **Dedicated Product Detail Pages (`/product/[slug]`)**:
   - High-resolution commercial product photography.
   - Packaging specifications (e.g. *1 Litre Glass Bottle*, *800g Wrapped Loaf*).
   - Detailed farm origin, ingredients, and storage guidance.
   - Stock availability status and physical count verification badge.
   - Quantity selector with dynamic stock cap.
   - 1-Click "Ask a Question About This Product" button.

3. **Dedicated Customer Enquiry Page (`/enquiry`) & Contextual Modals**:
   - Explicit UI distinction: Clearly educates customers that enquiries **do not reserve stock** or place confirmed orders.
   - General inquiries, holiday bulk order requests, or dietary questions.
   - Pre-fills product details when launched from a product card.
   - Automatic receipt acknowledgement screen with reference ID (`ENQ-XXX`).

4. **Customer Live Order Tracking (`/order/[id]?token=...`)**:
   - Secure token-based lookup (no customer account creation required).
   - 5-step visual milestone timeline:  
     `Pending` ➔ `Confirmed` ➔ `Processing` ➔ `Ready` ➔ `Fulfilled` (or `Cancelled`).
   - Packaging details, collection instructions, counter telephone shortcut.

5. **Shopkeeper Admin Portal (`/admin`) & Authentication (`/admin/login`)**:
   - **Authentication Barrier**: Unauthenticated visitors are blocked and redirected to `/admin/login`.
   - **Demo Credentials Screen**: Auto-fills `admin@greenwood.local` / `shopsync2026`.
   - **Urgent Tasks First Overview**: Prominently displays:
     - Pending order requests requiring confirmation.
     - Low-stock warnings near reorder threshold.
     - Uncontacted customer queries.
     - Real-time Daily Fulfilment Capacity gauge with progress bar.
   - **Master Order Pause Toggle**: 1-click button to pause new order intake while keeping product browsing & enquiries active.
   - **Order Lifecycle Management**: Triage orders across exact Phase 2 statuses (`Pending`, `Confirmed`, `Processing`, `Ready`, `Fulfilled`, `Cancelled`).
   - **Rapid Shelf Inventory Adjuster**: Fast shelf-side controls (`+1`, `-1`, `+5`, and `Set Sold Out`) for rapid counter count reconciliation.
   - **Enquiry Inbox**: Filter and transition enquiries across `New`, `Contacted`, and `Resolved`.
   - **Capacity Settings & Resilient Outbox**: Adjust daily order caps and review email delivery logs.

---

## 2. Screen & Route Directory

| URL Path | Screen Name | Role | Primary Features |
| :--- | :--- | :--- | :--- |
| `/` | Storefront & Catalogue | Customer | Category filters, search, stock badges, basket drawer, capacity indicator. |
| `/product/[slug]` | Product Detail View | Customer | High-res imagery, packaging specs, ingredients, origin, verified audit tag. |
| `/enquiry` | Standalone Enquiry Page | Customer | Product inquiry form, enquiry vs. order guidance, auto-receipt. |
| `/order/[id]` | Order Tracking Page | Customer | 5-step visual progress bar, collection window, counter contact. |
| `/admin/login` | Shopkeeper Sign-in | Admin | Authentication barrier with pre-filled demo credentials. |
| `/admin` | Owner Cockpit | Admin | Urgent tasks first, daily capacity gauge, order triage, shelf inventory, enquiry inbox. |

---

## 3. Business Rules Implemented in Prototype

1. **Enquiry vs Order Separation**:
   - Enquiries never decrement or hold inventory.
   - Clear educational copy prevents false customer expectations.
2. **Order Intake Pausing**:
   - The shopkeeper can pause orders at any time.
   - Storefront automatically displays: *"Order intake is paused today. Product browsing and enquiries remain open!"*
   - Checkout is blocked with status 409, while enquiry forms remain available.
3. **Atomic Stock & Capacity Protection**:
   - Simultaneous checkouts cannot oversell inventory.
   - When daily order cap is reached, date picker blocks further orders for that day.
4. **Lifecycle Auditability**:
   - Cancelling an order releases reserved stock back to shelf inventory.
   - Fulfilling an order permanently decrements `quantityOnHand`.
   - All status transitions log an outbox email notification.

---

## 4. Test Suite Execution Summary

The prototype was tested via [`scripts/test_workflow.js`](file:///e:/COLLEGE/MY_OWN_PROJECTS/ShopSync/scripts/test_workflow.js):
- **Storefront & Catalog**: 6 active products loaded with packaging and stock metrics.
- **Admin Auth**: Rejects unauthorized access (401), grants session to `admin@greenwood.local`.
- **Enquiry Lifecycle**: `New` ➔ `Contacted` ➔ `Resolved` verified.
- **Pause Order Intake**: Verified orders blocked while enquiries succeed.
- **Order Lifecycle**: `Pending` ➔ `Confirmed` ➔ `Processing` ➔ `Ready` ➔ `Fulfilled` verified.
- **Tracking Page**: Live lookup verified.
- **Outbox Resilience**: 6 notification logs preserved.
