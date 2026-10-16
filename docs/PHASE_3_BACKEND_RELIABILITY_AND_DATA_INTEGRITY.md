# ShopSync — Phase 3: Backend Reliability, Data Integrity & Core Development

> **"Your Shop. Online. In Control."**  
> *Architecture Audit, Concurrency Hardening, Inventory Invariants, Persistent Storage Migration, and Automated Verification.*

---

## 1. Executive Summary

Phase 3 transitions ShopSync from an in-memory prototype with single-process file-backed persistence to an **ACID-compliant, concurrency-hardened, multi-process safe production backend**.

### Core Problems Addressed:
1. **Overselling & Race Conditions**: Two simultaneous checkouts could previously reserve the same last units or exceed daily fulfilment capacity.
2. **Multi-Process & Restart Fragility**: An in-memory JavaScript Promise mutex (`SimpleMutex`) offered zero protection across multiple Node processes, worker threads, or clustering.
3. **Data Leaks & Inadequate Authorization**: Admin endpoints lacked server-side session checks, allowing unauthenticated visitors to query customer lists or alter store settings.
4. **Outbox Simulation vs. Durability**: Outbox messages were optimistically marked `DELIVERED` without actual SMTP delivery, bounded retries, or error tracking.
5. **Reservation Leaks**: Stale reservations lacked automated expiration and lazy-reaping, risking stock lockup.

---

## 2. Storage Layer Audit & SQLite Migration

### Audit of Previous File-Backed JSON Store (`src/lib/storage.ts`)

| Criterion | Previous Implementation (`data/db.json` + `SimpleMutex`) | Risk Level | Phase 3 Solution (`node:sqlite` + WAL Mode) |
| :--- | :--- | :--- | :--- |
| **Atomic Writes** | Written to `db.json.tmp` then renamed. On Windows, `fs.rename` can throw `EPERM` if file is locked. | **Medium** | SQLite Write-Ahead Logging (WAL) with OS-level atomic page writes and checksums. |
| **Cross-Process Concurrency** | In-process `SimpleMutex` only serializes within a single Node.js event loop. Multi-process/clustering had zero mutex protection. | **Critical** | SQLite OS-level file locking with `BEGIN IMMEDIATE` transactions. Multi-process safe out of the box. |
| **Transaction Rollbacks** | Partial writes or mid-function exceptions could leave data desynchronized. No rollback mechanism. | **High** | True ACID transactions with automatic `ROLLBACK` on error. |
| **Infrastructure Cost** | $0/month. | **None** | **$0/month**. Uses Node.js built-in `node:sqlite`. Zero external servers, zero cloud DB fees. |

### Technical Decision: Node.js Built-In SQLite (`node:sqlite`)
Rather than introducing heavy cloud databases (e.g., hosted PostgreSQL) that burden a small local business with monthly fees and networking latency, ShopSync adopted **Node.js built-in `node:sqlite` (`DatabaseSync`)**:
- **Zero Native Addons**: Eliminates `node-gyp` and MSVC compilation issues on Windows.
- **WAL Mode (`PRAGMA journal_mode = WAL;`)**: Concurrent readers never block writers, and writers never block readers.
- **Busy Timeout (`PRAGMA busy_timeout = 5000;`)**: Transparently queues concurrent writes up to 5 seconds.
- **Single Embedded File (`data/shopsync.db`)**: Easy backup, snapshotting, and restoration.

### Database Schema

```sql
-- Store Settings (Single Row: id = 1)
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  shop_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  business_hours TEXT NOT NULL,
  daily_capacity INTEGER NOT NULL CHECK (daily_capacity >= 0),
  is_store_open INTEGER NOT NULL DEFAULT 1,
  orders_paused INTEGER NOT NULL DEFAULT 0,
  notice_banner TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  time_slots TEXT NOT NULL,
  reservation_ttl_minutes INTEGER NOT NULL DEFAULT 120
);

-- Products & Inventory
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  packaging TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  quantity_on_hand INTEGER NOT NULL CHECK (quantity_on_hand >= 0),
  reserved_quantity INTEGER NOT NULL CHECK (reserved_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 2 CHECK (low_stock_threshold >= 0),
  track_stock INTEGER NOT NULL DEFAULT 1,
  last_verified_at TEXT NOT NULL,
  origin TEXT,
  ingredients TEXT,
  storage_info TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Orders
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  tracking_token TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  fulfilment_type TEXT NOT NULL,
  delivery_address TEXT,
  scheduled_date TEXT NOT NULL,
  scheduled_slot TEXT NOT NULL,
  status TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total_amount REAL NOT NULL,
  customer_notes TEXT,
  admin_notes TEXT,
  cancellation_reason TEXT,
  reservation_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Customer Enquiries
CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  enquiry_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  product_id TEXT,
  product_title TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  admin_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Notification Outbox
CREATE TABLE notification_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  status TEXT NOT NULL, -- 'PENDING', 'DELIVERED', 'FAILED', 'SIMULATED'
  attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  idempotency_key TEXT UNIQUE,
  timestamp TEXT NOT NULL
);

-- Idempotency Records
CREATE TABLE idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### Migration & Backup Procedure
1. When the server boots, `getDatabase()` in `src/lib/db.ts` verifies table existence.
2. If `products` count is 0 and `data/db.json` exists:
   - A timestamped backup is created: `data/db.backup.<timestamp>.json`.
   - Settings, products, orders, enquiries, and logs are parsed and inserted inside a single `BEGIN IMMEDIATE` transaction.
   - Record counts and constraints are verified.
3. **Rollback Procedure**: If rollback is ever required:
   - Stop application: `npm stop` / kill Node process.
   - Remove `data/shopsync.db`, `data/shopsync.db-wal`, `data/shopsync.db-shm`.
   - Copy `data/db.backup.<timestamp>.json` back to `data/db.json`.

---

## 3. Inventory Invariants & State Transitions

### Invariant Rules
1. **Physical Stock (`quantityOnHand`)**: Represents counted inventory on the shop floor (`quantityOnHand >= 0`).
2. **Reserved Stock (`reservedQuantity`)**: Represents inventory committed to active, unfulfilled orders (`reservedQuantity >= 0`).
3. **Available Stock**: Dynamically computed as `Math.max(0, quantityOnHand - reservedQuantity)`.
4. **Enquiry Isolation**: Customer enquiries never reserve or hold inventory.
5. **Exact-Once Fulfillment Deduction**: When an order transitions to `Fulfilled` / `COMPLETED`, `quantityOnHand` and `reservedQuantity` are decremented exactly once. Re-confirming or updating metadata does not deduct stock again.
6. **Exact-Once Cancellation Release**: When an order is `Cancelled` or `REJECTED`, `reservedQuantity` is released back to available stock exactly once.
7. **Shelf Count Adjustments**: When the shopkeeper adjusts physical count on the shelf (`POST /api/products/[id]/stock`), `reservedQuantity` is preserved intact, and available stock dynamically reflects the new shelf count.

### Order Status State Machine

```
[Customer Checkout]
        │
        ▼
   ┌─────────┐
   │ Pending │  ◄── Stock reserved, TTL active
   └────┬────┘
        ├────────────────────────────────┐
        │ Owner Confirm                  │ Auto-Expiry / Owner Rejection
        ▼                                ▼
  ┌───────────┐                    ┌───────────┐
  │ Confirmed │                    │ Cancelled │ (Terminal — Stock Released)
  └─────┬─────┘                    └───────────┘
        │ Start Prep                     ▲
        ▼                                │
 ┌────────────┐                          │ Owner Cancellation
 │ Processing │                          │
 └──────┬─────┘                          │
        │ Pack Complete                  │
        ▼                                │
    ┌───────┐                            │
    │ Ready │ ───────────────────────────┘
    └───┬───┘
        │ Customer Pickup / Handover
        ▼
  ┌───────────┐
  │ Fulfilled │ (Terminal — Physical Stock Deducted Once)
  └───────────┘
```

---

## 4. Concurrency & Checkout Protections

1. **Atomic Multi-Item Reservation**:
   - `createOrderAtomic` executes inside `runTransaction` (`BEGIN IMMEDIATE`).
   - SQLite locks out concurrent writers at the OS level while checking available stock across all requested items.
   - If even one item has insufficient stock, the entire checkout aborts with HTTP 409 and **zero stock is reserved**.
2. **Atomic Date-Specific Capacity**:
   - Before reserving stock, active orders for `scheduledDate` are counted.
   - If `count >= dailyCapacity`, checkout aborts with HTTP 409 and informs the customer to pick another date or send an enquiry.
3. **Idempotency Protection**:
   - Accepts `Idempotency-Key` HTTP header.
   - If a duplicate request arrives (e.g., client network retry or double-click), the stored order is returned with HTTP 200 without creating a duplicate order or double-reserving stock.
4. **Reservation Expiry & Sweeper**:
   - Orders have a configurable TTL (`reservationTtlMinutes`, default 120 minutes).
   - `sweepExpiredReservations()` runs before checkout and capacity reads:
     - Cancels expired pending orders.
     - Releases held reserved stock.
     - Dispatches outbox expiry notifications.
5. **Confirmation Race Condition Handling**:
   - If an owner attempts to confirm an order after its reservation has expired, the transaction detects the expired timestamp, aborts with HTTP 409, and prevents corrupted negative stock.

---

## 5. Security & Authentication Hardening

1. **Admin Authorization Guard (`requireAdminAuth`)**:
   - Enforced on all admin endpoints:
     - `PATCH /api/store`
     - `GET /api/orders`
     - `PATCH /api/orders/[id]`
     - `POST /api/products`
     - `POST /api/products/[id]/stock`
     - `GET /api/enquiries`
     - `PATCH /api/enquiries/[id]`
     - `GET /api/notifications`
     - `POST /api/notifications` (retry)
   - Unauthenticated requests are rejected with HTTP 401 Unauthorized.
2. **Public Data Sanitization**:
   - `GET /api/store` for unauthenticated visitors returns only public `settings` and `products`. Customer names, phones, addresses, and logs are completely excluded.
3. **Session Security**:
   - Signed session tokens with HMAC-SHA256 (`src/lib/auth.ts`).
   - Cookie attributes: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 7 days`, `secure: process.env.NODE_ENV === 'production'`.
4. **Strict Tracking Token Validation**:
   - `GET /api/orders/[id]/track?token=...`:
     - Access token is strictly required. Missing or forged tokens return HTTP 401/404.
     - Leaked internal fields (`adminNotes`, internal tracking token) are redacted.
5. **Production Demo Credentials Handling**:
   - Demo credentials banner is hidden in production (`NODE_ENV === 'production'`).
   - Initial credentials configured via environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`).

---

## 6. Reliable Notification Outbox

1. **Transactional Outbox**:
   - Notifications are written to `notification_logs` table with status `PENDING` before network attempts.
   - Failure to send email never rolls back or fails a valid customer order or enquiry.
2. **Configurable SMTP vs. Simulated Mode**:
   - When `SMTP_HOST` is configured, uses `nodemailer` to dispatch genuine emails.
   - When `SMTP_HOST` is omitted, the outbox operates in clearly labelled `SIMULATED` mode. It **never** falsely reports simulated emails as delivered.
3. **Bounded Retries & Error Logging**:
   - Max retry attempts: 3.
   - Error messages and timestamps are captured in the outbox.
   - Failed notifications are displayed in the Admin Dashboard with a one-click **Retry** button.
   - Idempotency keys prevent duplicate email dispatch during retries.

---

## 7. Automated Test Suite Execution Results

All tests were executed against the live running application via [`scripts/test_workflow.js`](file:///e:/COLLEGE/MY_OWN_PROJECTS/ShopSync/scripts/test_workflow.js):

```
===============================================================
🧪 SHOPSYNC COMPREHENSIVE BACKEND VERIFICATION SUITE (PHASE 3)
===============================================================

▶ [BASELINE 1] Checking Storefront Initial Data & Metadata...
  ✓ Store Name: Greenwood Provisions
  ✓ Daily Capacity: 12 orders/day
  ✓ Active Products: 6

▶ [BASELINE 2] Testing Admin Authentication & Cookie Security...
  ✓ Unauthenticated rejection (Status 401): "Invalid email or password."
  ✓ Authenticated Shopkeeper: admin@greenwood.local (Role: Shopkeeper Admin)
  ✓ Hardened Session Cookie: shopsync_session=eyJlb...

▶ [BASELINE 3] Testing Customer Enquiry Submission (New ➔ Contacted ➔ Resolved)...
  ✓ Enquiry Created: Ref ENQ-517 (Status: New)
  ✓ Enquiry Status: Contacted
  ✓ Enquiry Status: Resolved

▶ [BASELINE 4] Testing "Pause Order Intake" Feature...
  ✓ Store ordersPaused set to TRUE
  ✓ Order rejection during pause (Status 409): "New order intake is temporarily paused..."
  ✓ Enquiry while orders paused: Ref ENQ-518 (Status: New)
  ✓ Store ordersPaused resumed to FALSE

▶ [SUITE 1] Testing Concurrent Checkout Race on Last Available Stock...
  ✓ Concurrency Protection: 1 succeeded (200), 1 rejected (409): "Insufficient stock for "Handcrafted Dark Chocolate Sea Salt Truffles". Requested: 1, Available: 0. Please adjust quantity."

▶ [SUITE 2] Testing Concurrent Race for Final Daily Capacity Slot...
  ✓ Capacity Protection: 1 succeeded (200), 1 rejected (409): "Daily fulfilment capacity (2 orders) has been reached for 2026-11-18. Please select another date or send an enquiry."

▶ [SUITE 3] Testing Reservation Expiry and Automatic Resource Release...
  ✓ Reservation Expiry: Order auto-cancelled and 2 reserved units released back to shelf inventory.

▶ [SUITE 4] Testing Owner Confirmation Racing with Expired Reservation...
  ✓ Race Protection: Rejection response (Status 409): "Invalid status transition from "Cancelled" to "Confirmed". Order is in terminal or non-permissible state."

▶ [SUITE 5] Testing Duplicate Checkout Submission (Idempotency Protection)...
  ✓ Idempotency Verified: Duplicate submission returned original ORD-1007 without double-booking.

▶ [SUITE 6] Testing Inventory Adjustments with Active Reservations...
  ✓ Invariant Verified: Physical: 5, Reserved: 2, Available: 3. Active reservations preserved.

▶ [SUITE 7] Testing Cancellation Stock Release and Safe Rescheduling...
  ✓ Cancellation & Reschedule: Rescheduled safely, cancellation released reservations exactly once.

▶ [SUITE 8] Testing Capacity Reductions while Orders Already Exist...
  ✓ Capacity Reduction: Existing 3 orders intact, new orders safely blocked (Status 409).

▶ [SUITE 9] Testing Notification Outbox, Retries, and Deduplication...
  ✓ Outbox State: Latest subject: "Order Received: ORD-1011 (Pending Review)" (Status: SIMULATED)
  ✓ Bounded Retry: Notification delivery attempted with recorded attempt count.

▶ [SUITE 10] Testing Authorization Guards on Every Admin Endpoint...
  ✓ All 8 Admin API endpoints strictly reject unauthenticated requests with HTTP 401.

▶ [SUITE 11] Testing Validation: Invalid Quantities, Dates & Status Transitions...
  ✓ Invalidation: Zero/negative quantities, bad date formats, and illegal status transitions rejected.

▶ [SUITE 12] Testing Strict Order Tracking Token Validation...
  ✓ Tracking Security: Token strictly required, forged tokens rejected, sensitive admin fields redacted.

▶ [SUITE 13] Verifying SQLite Data Persistence Across Lifecycles...
  ✓ Durability: ACID storage verified in data/shopsync.db with WAL mode.

▶ [SUITE 14] Testing Transaction Rollback on Interrupted Write...
  ✓ Atomicity Verified: Failed multi-item checkout rolled back completely with zero leaked reservations.

===============================================================
🎉 ALL 14 PHASE 3 VERIFICATION SUITES EXECUTED & PASSED!
===============================================================
```

---

## 8. Verification & Operational Commands

### Running Locally
```cmd
# Install dependencies
npm install

# Build production bundle
npm run build

# Start production server (port 3000)
npm run start -- -p 3000
```

### Running Test Verification
```cmd
node scripts/test_workflow.js
```
