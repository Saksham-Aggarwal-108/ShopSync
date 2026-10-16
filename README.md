# ShopSync — Your Shop. Online. In Control.

> **A balanced, resilient digital storefront and operational cockpit designed for independent neighbourhood shops.**

---

## 🌟 Overview

ShopSync addresses a common tipping point for local shops: gaining digital traction without becoming overwhelmed by unstructured chat messages, phantom stock, or orders exceeding fulfilment capability.

It provides:
1. **Public Storefront (`/`)**:
   - Real-time catalog with category filtering and instant search.
   - High-resolution product photos, packaging details (e.g. *1 Litre Glass Bottle*, *800g Wrapped Loaf*), and live stock availability badges (*In Stock*, *Low Stock: Only X Left*, *Sold Out*).
   - In-store pickup & local delivery scheduling.
   - Real-time **Daily Fulfilment Capacity Indicator** preventing overbooking.
   - Direct enquiry modal with automatic acknowledgement and reference logging.
2. **Owner Cockpit (`/admin`)**:
   - **One-Glance Header**: Live store status toggle (*Open / Closed*) and real-time **Daily Fulfilment Capacity Gauge** (e.g. *3 / 12 Orders (25%)*).
   - **Live Orders Queue**: Triage pending orders with 1-click actions: *Confirm & Reserve*, *Reschedule*, *Mark Ready for Collection*, *Complete & Deduct Stock*, or *Reject with Reason*.
   - **Rapid Shelf Inventory Adjuster**: 1-tap `+1`, `-1`, `+5`, and `Set Sold Out` controls for quick counter stock reconciliation without complex forms.
   - **Customer Enquiries Inbox**: Centralized question management with status flags (*New*, *In Progress*, *Replied*, *Converted*).
   - **Capacity Settings & Outbox Audit Logs**: Adjust daily order caps and inspect all queued/delivered customer notifications.
3. **Live Order Tracker (`/order/[id]?token=...`)**:
   - Customer-facing milestone tracker: *Received (Soft-reserved)* ➔ *Confirmed (Hard-reserved)* ➔ *Ready for Collection / Out for Delivery* ➔ *Completed*.
   - Clear pickup instructions, packaging specifications, and shop counter contact details.

---

## 🛠️ Technology Stack & Architecture

- **Full-Stack Framework**: Next.js 14 (App Router, React 18, TypeScript 5)
- **Styling**: Vanilla CSS Design System with custom tokens, responsive grid, glassmorphic headers, and micro-animations.
- **Database & Storage**: Thread-safe, atomic file-backed JSON repository (`src/lib/storage.ts`) with asynchronous mutex locks preventing race conditions and overselling.
- **Resilience**: Outbox pattern for email notifications; third-party email failures never roll back or delete customer orders.

---

## 🚀 Running the Application

### 1. Start the Production Server
```bash
npm run start -- -p 3000
```
Or start in development mode:
```bash
npm run dev
```

### 2. Access the Application
- **Customer Storefront**: [http://localhost:3000](http://localhost:3000)
- **Shop Owner Cockpit**: [http://localhost:3000/admin](http://localhost:3000/admin)

### 3. Run Automated Workflow Verification
```bash
node scripts/test_workflow.js
```
This tests store querying, customer enquiry submission, atomic checkout, overselling prevention (HTTP 409), admin order confirmation, rapid shelf adjustment, and notification logging.

---

## 🔒 Concurrency & Business Rules

1. **Atomic Stock Locking**: Conditional reservation ensures simultaneous checkouts of remaining stock never oversell.
2. **Daily Capacity Guard**: Once the daily order limit is reached, the date picker prevents checkout and prompts customers to enquire or pick another day.
3. **Inquiry vs. Order Separation**: Enquiries never decrement stock or create phantom holds.
4. **Resilient Outbox**: Notification delivery errors are caught, logged, and retried without losing order records.
