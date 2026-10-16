# ShopSync — Phase 6: Architecture Migration Report
**Transition to Vercel (Frontend) + Render (Node.js API) + Supabase (PostgreSQL)**

**Date:** October 16, 2026  
**Status:** Completed & Tested Locally  
**Runtime:** Node.js v24.21.0 (Compatible with `node >= 22.5.0`)  
**Deployment State:** Awaiting Review & User Authorization (No public deployment executed)

---

## 1. Executive Summary

Phase 6 successfully transitions ShopSync from an embedded SQLite architecture (`node:sqlite`) to a modern, decoupled three-tier cloud deployment:
1. **Frontend:** Vercel (Next.js 14 Storefront & Admin Dashboard).
2. **Backend API:** Render (Dedicated Node.js Web Service running API routes, listening on `0.0.0.0:$PORT`).
3. **Database:** Supabase (Managed PostgreSQL 15+ with connection pooling and row-level locking).

All existing artisanal storefront features, shopkeeper management workflows, enquiry lifecycle states, stock management tools, and order tracking protections have been preserved intact without deleting features or weakening invariants.

---

## 2. Key Architecture & Code Changes

### A. Database Persistence Migration (`node:sqlite` -> Supabase PostgreSQL)
- **Driver Replacement:** Replaced `node:sqlite` with `pg` (v8.23.1) and connection pooling (`pg.Pool`).
- **Parameterized SQL Queries:** Converted all SQL queries from SQLite positional `?` placeholders to PostgreSQL standard `$1, $2, ...` syntax across all models.
- **Atomic Concurrency Control:**
  - Implemented row-level locking (`SELECT ... FOR UPDATE`) in `createOrderAtomic` to guarantee that concurrent checkouts against the final available stock unit cannot oversell.
  - Implemented transaction-scoped locking on `settings` (`FOR UPDATE`) to serialize capacity validation across concurrent requests, strictly enforcing `daily_capacity`.
  - Converted SQLite `MAX(0, ...)` expressions to PostgreSQL scalar `GREATEST(0, ...)`.
- **Database Abstraction (`src/lib/db.ts`):**
  - Connects to Supabase PostgreSQL with SSL encryption (`ssl: { rejectUnauthorized: false }`) and connection pooling (`max: 10`).
  - Implements offline in-memory PostgreSQL engine fallback (`pg-mem`) for automated local test runners and offline development without requiring a local Docker daemon.
- **Repeatable Versioned Schema:**
  - Created `scripts/schema.sql` (PostgreSQL DDL) defining all 7 core tables, constraints, indexes, and a `schema_migrations` tracking table.
  - Created `scripts/migrate.js` to automate schema execution and initial artisan product catalogue seeding.

### B. Security & Cross-Origin Adaptation
- **CSRF Origin Protection (`src/lib/auth.ts`):**
  - Updated `requireAdminAuth` to validate incoming `Origin` headers against allowed origins (`FRONTEND_URL` and `ALLOWED_ORIGINS`).
  - State-changing mutation requests from unauthorized cross-origin callers are rejected with HTTP 403 Forbidden.
- **Adaptive Session Cookies (`src/app/api/auth/login/route.ts`):**
  - When deployed via the Vercel reverse proxy, cookies use `SameSite=Lax` and `HttpOnly`, functioning as first-party cookies without being blocked by Safari ITP or third-party cookie restrictions.
  - For direct cross-origin calls, `CROSS_ORIGIN_COOKIES=true` enables `SameSite=None; Secure`.
- **Persistent Multi-Instance Rate Limiting (`src/lib/rateLimit.ts`):**
  - Migrated `rate_limits` table to PostgreSQL with atomic `ON CONFLICT (key) DO UPDATE` and `FOR UPDATE` row locking.
  - Rate limiting now persists seamlessly across Render backend restarts and horizontal worker scaling.
- **Notification Outbox Safety (`src/lib/notifications.ts`):**
  - Outbox logs and delivery attempt counts are recorded in the PostgreSQL `notification_logs` table.
  - SMTP remains disabled / simulated by default (`SMTP_HOST=""`) during staging and migration. Real customer emails cannot be dispatched without explicit credentials.

### C. Frontend / Backend Separation
- **Reverse Proxy Rewrites (`next.config.js`):**
  - Configured Next.js rewrites: when `BACKEND_API_URL` is set, requests matching `/api/:path*` are proxied directly to `${BACKEND_API_URL}/api/:path*`.
- **CORS Headers (`next.config.js`):**
  - Configured `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`, and preflight `OPTIONS` headers on API routes.
- **API Client Utility (`src/lib/apiClient.ts`):**
  - Provides `apiFetch` helper that transparently routes requests through the proxy rewrite or direct `NEXT_PUBLIC_API_URL`.

---

## 3. Verification & Test Evidence

### Test Suite Execution
- **Command:** `node scripts/test_workflow.js`
- **Target:** Production Next.js server running on `http://localhost:3000`
- **Total Test Suites:** 22
- **Passed Test Suites:** 22
- **Failed Test Suites:** 0

| Suite # | Test Suite Description | Result |
| :---: | :--- | :---: |
| 1 | Storefront Initial Data, Public Metadata & Sanitized Health Probe | **PASSED** |
| 2 | Admin Authentication & Hardened Cookie Security | **PASSED** |
| 3 | Customer Enquiry Submission & Lifecycle (New -> Contacted -> Resolved) | **PASSED** |
| 4 | Pause Order Intake & Enquiries Storefront Availability | **PASSED** |
| 5 | Concurrent Checkout Race on Last Available Stock (Row Locking) | **PASSED** |
| 6 | Concurrent Race for Final Daily Capacity Slot | **PASSED** |
| 7 | Reservation Expiry and Automatic Resource Release | **PASSED** |
| 8 | Owner Confirmation Racing with Expired Reservation | **PASSED** |
| 9 | Duplicate Checkout Submission & Idempotency Key Replay Protection | **PASSED** |
| 10 | Inventory Adjustments with Active Reservations Invariant | **PASSED** |
| 11 | Cancellation Stock Release and Safe Rescheduling | **PASSED** |
| 12 | Capacity Reductions while Orders Already Exist | **PASSED** |
| 13 | Notification Outbox Delivery, Retries, and Deduplication | **PASSED** |
| 14 | Admin Authentication Token Guard on Privileged Mutations | **PASSED** |
| 15 | Input Validation: Zero/Negative Quantities & Illegal Transitions | **PASSED** |
| 16 | Strict Order Tracking Token Validation & Public Sanitization | **PASSED** |
| 17 | PostgreSQL Data Persistence Across Application Lifecycles | **PASSED** |
| 18 | Transaction Atomicity & Rollback on Interrupted Writes | **PASSED** |
| 19 | Rate Limiting & Abuse Protection on Sensitive Endpoints (HTTP 429) | **PASSED** |
| 20 | Cross-Site Request Forgery (CSRF) Origin Hardening | **PASSED** |
| 21 | Live PostgreSQL Database Backup & Isolated Restore | **PASSED** |
| 22 | Production Secret Hardening & Public Response Sanitization | **PASSED** |

---

## 4. Exact Manual Steps for Platform Dashboards

Before public launch, the repository owner must complete the following configuration steps in the respective cloud dashboards:

### 1. Supabase Dashboard
1. Create a new project: `shopsync-db`.
2. Save the database password securely.
3. In **SQL Editor**, paste and run `scripts/schema.sql`.
4. In **Project Settings** -> **Database**, copy the **Connection Pooling URI** (`port 6543`).

### 2. Render Dashboard
1. Create a new **Web Service** pointing to the ShopSync repository.
2. Build command: `npm install && npm run build`
3. Start command: `npx next start -p $PORT -H 0.0.0.0`
4. Health check path: `/api/health`
5. Under **Environment**, add:
   - `DATABASE_URL`: *(Your Supabase connection string)*
   - `DATABASE_SSL`: `true`
   - `ADMIN_PASSWORD`: *(A strong secret passphrase)*
   - `SESSION_SECRET`: *(A random 64-character hex string)*
   - `STRICT_PRODUCTION_SECRETS`: `true`
   - `FRONTEND_URL`: `https://shopsync.vercel.app`
   - `ALLOWED_ORIGINS`: `https://shopsync.vercel.app`

### 3. Vercel Dashboard
1. Import the ShopSync repository into Vercel.
2. Under **Environment Variables**, add:
   - `BACKEND_API_URL`: `https://shopsync-api.onrender.com`
3. Deploy the project.
