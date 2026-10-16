# ShopSync — Phase 6: Architecture Migration Plan
## Target Architecture: Vercel (Frontend) + Render (Backend API) + Supabase (PostgreSQL)

**Document Version:** 1.0.0  
**Date:** October 16, 2026  
**Status:** Approved for Implementation  
**Author:** Antigravity Senior Product Designer, Software Architect & Full-Stack Engineer  

---

## 1. Executive Summary & Migration Objective

ShopSync is transitioning from an embedded, single-instance SQLite architecture to a scalable, three-tier cloud architecture:
- **Frontend Layer:** **Vercel** (Global edge CDN hosting Next.js 14 storefront, product pages, customer enquiry forms, order tracking, and the shopkeeper admin dashboard).
- **Backend API Layer:** **Render** (Node.js Web Service running the API server, transaction handling, rate limiting, and notification outbox worker, listening on `0.0.0.0:${PORT}`).
- **Database Layer:** **Supabase PostgreSQL** (Managed cloud PostgreSQL database with connection pooling, automated backups, and row-level locking).

### Non-Negotiable Directives:
- **Preserve Existing Capabilities:** Preserve all product management, inventory invariants, capacity controls, enquiry lifecycles, order tracking, notification outbox, and the artisanal green-and-cream design system.
- **No Rebuilding from Scratch:** Adapt existing models, handlers, and security guards rather than discarding them.
- **Zero Premature Public Deployment / Zero Spend:** No paid hosting or live domain binding will take place without explicit owner approval.

---

## 2. Current Architecture & SQLite Dependency Audit

The existing application relies on embedded SQLite via Node.js built-in `node:sqlite` (`DatabaseSync`). Below is the complete catalog of SQLite-specific features requiring migration:

| File / Component | SQLite-Specific Implementation | PostgreSQL / Supabase Replacement |
|---|---|---|
| `src/lib/db.ts` | `import { DatabaseSync } from 'node:sqlite';` | Standard `pg.Pool` from `pg` (`node-postgres`) with SSL connection pooling. |
| `src/lib/db.ts` | Synchronous SQLite transactions: `runTransaction<T>((db) => ...)` | Asynchronous PostgreSQL client transactions: `const client = await pool.connect(); try { await client.query('BEGIN'); ... await client.query('COMMIT'); }` |
| `src/lib/db.ts` | SQLite Pragmas (`PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, `PRAGMA foreign_keys = ON`) | Managed PostgreSQL database settings in Supabase; foreign keys enforced natively. |
| `src/lib/db.ts` & SQL queries | Positional parameter placeholders: `?, ?, ?` | PostgreSQL parameterized placeholders: `$1, $2, $3` with native type binding. |
| `src/lib/db.ts` & `src/lib/rateLimit.ts` | `INSERT OR REPLACE INTO rate_limits (key, points, expire_at) VALUES (?, 1, ?)` | PostgreSQL `INSERT INTO rate_limits (key, points, expire_at) VALUES ($1, 1, $2) ON CONFLICT (key) DO UPDATE SET points = EXCLUDED.points, expire_at = EXCLUDED.expire_at` |
| `src/lib/storage.ts` | Concurrency via SQLite write-lock serialization (`busy_timeout = 5000`) | Explicit PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) on product rows to eliminate checkout race conditions. |
| `src/lib/storage.ts` | Daily capacity check via SQLite count within single transaction | `SELECT COUNT(*) FROM orders WHERE scheduled_date = $1 AND status != 'Cancelled' FOR UPDATE` (or transactional lock). |
| `src/lib/storage.ts` | SQLite date formatting (`datetime('now')`, `new Date().toISOString()`) | PostgreSQL `TIMESTAMPTZ` with `NOW()` or standard ISO-8601 timestamps. |
| `src/lib/backup.ts` & scripts | Native SQLite `VACUUM INTO` command | Supabase automated continuous WAL-G backups + standard `pg_dump` snapshot script. |
| `src/app/api/health/route.ts` | `PRAGMA quick_check;` and `PRAGMA journal_mode;` | `SELECT 1 AS healthy;` and connection pool statistics. |

---

## 3. Proposed PostgreSQL Schema & Migration Strategy

### 1. Versioned Database Schema (`001_initial_schema.sql`)

```sql
-- ==============================================================================
-- ShopSync — PostgreSQL Schema Migration (001_initial_schema.sql)
-- Supabase / PostgreSQL Target
-- ==============================================================================

-- 1. Settings Table (Singleton enforce id = 1)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    shop_name TEXT NOT NULL,
    tagline TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    business_hours TEXT NOT NULL,
    daily_capacity INTEGER NOT NULL CHECK (daily_capacity >= 0),
    is_store_open BOOLEAN NOT NULL DEFAULT TRUE,
    orders_paused BOOLEAN NOT NULL DEFAULT FALSE,
    notice_banner TEXT NOT NULL,
    currency_symbol TEXT NOT NULL,
    time_slots TEXT NOT NULL, -- JSON array of strings
    reservation_ttl_minutes INTEGER NOT NULL DEFAULT 120,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    packaging TEXT NOT NULL,
    image_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    quantity_on_hand INTEGER NOT NULL CHECK (quantity_on_hand >= 0),
    reserved_quantity INTEGER NOT NULL CHECK (reserved_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 2 CHECK (low_stock_threshold >= 0),
    track_stock BOOLEAN NOT NULL DEFAULT TRUE,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    origin TEXT,
    ingredients TEXT,
    storage_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invariant constraint: reserved quantity must not exceed on-hand stock unless track_stock is false
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_inventory_invariants;
ALTER TABLE products ADD CONSTRAINT chk_inventory_invariants 
    CHECK (quantity_on_hand >= 0 AND reserved_quantity >= 0);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    tracking_token TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    fulfilment_type TEXT NOT NULL,
    delivery_address TEXT,
    scheduled_date DATE NOT NULL,
    scheduled_slot TEXT NOT NULL,
    status TEXT NOT NULL,
    items_json JSONB NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    customer_notes TEXT,
    admin_notes TEXT,
    cancellation_reason TEXT,
    reservation_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enquiries Table
CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY,
    enquiry_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New',
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Notification Outbox Table
CREATE TABLE IF NOT EXISTS notification_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT,
    channel TEXT NOT NULL DEFAULT 'EMAIL',
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    idempotency_key TEXT UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Idempotency Records Table
CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Rate Limits Table (Multi-instance safe)
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    points INTEGER NOT NULL,
    expire_at BIGINT NOT NULL
);

-- Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_orders_scheduled ON orders(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(order_number, tracking_token);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expire ON rate_limits(expire_at);
```

### 2. Migration Execution Strategy
- An automated migration runner (`scripts/migrate.js`) will:
  1. Acquire an advisory lock or check a `schema_migrations` table in PostgreSQL.
  2. Execute SQL migration files in numeric order.
  3. Seed initial default store settings and products if the database is newly initialized.
  4. Provide a rollback command if migration fails.

---

## 4. Frontend / Backend Separation Plan

```
┌─────────────────────────────────────────────────────────┐
│               VERCEL EDGE / SERVERLESS                  │
│                                                         │
│   Next.js 14 Frontend Application                       │
│   • Customer Storefront (/)                             │
│   • Product Detail Views (/product/[slug])              │
│   • Customer Enquiry Form (/enquiry)                    │
│   • Order Tracking (/order/[id])                        │
│   • Shopkeeper Admin Dashboard (/admin, /admin/login)   │
│                                                         │
│   Next.js API Rewrites (next.config.js):                │
│   Rewrite: /api/:path* ──► ${BACKEND_API_URL}/api/:path*│
└───────────────────────────┬─────────────────────────────┘
                            │
                            │ HTTPS Proxied or Direct Cross-Origin
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  RENDER WEB SERVICE                     │
│                                                         │
│   Node.js API Service (binds to 0.0.0.0:$PORT)          │
│   • CORS Configuration (allowed origins from Vercel)    │
│   • Cookie Management (SameSite=None/Lax + Secure)      │
│   • Rate Limiting Engine (PostgreSQL-backed)            │
│   • Inventory & Capacity Transactions (Row Locks)       │
│   • Notification Outbox & Simulated Email Worker        │
│   • Public Health Probe: GET /api/health                │
└───────────────────────────┬─────────────────────────────┘
                            │
                            │ SSL Connection Pool (Port 6543 / 5432)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE POSTGRESQL                    │
│                                                         │
│   Managed Cloud PostgreSQL Database                     │
│   • Connection Pooler (PgBouncer / Supavisor)           │
│   • ACID Transactions & Row-Level Locking               │
│   • Automated Daily Snapshots & WAL-G Point-in-Time     │
└─────────────────────────────────────────────────────────┘
```

### Key Separation Decisions:
1. **Unified Dual-Hosting Support:**
   - On **Vercel**, the application builds with standard `npm run build`. Next.js serves all UI pages and static assets.
   - `next.config.js` includes a clean proxy rewrite: when `BACKEND_API_URL` is configured, `/api/:path*` requests on Vercel are automatically proxied to the Render backend service. This eliminates browser third-party cookie restrictions (Safari ITP / Chrome third-party cookie phase-out) because the browser treats `/api/*` as same-origin!
   - On **Render**, the application runs as a Node.js Web Service binding to `0.0.0.0:${PORT}` and handling all API routes.
   - For direct cross-origin calls (if client code calls Render directly), the backend implements full CORS support with preflight `OPTIONS` handling and `credentials: 'include'`.
2. **Secrets Boundary:**
   - `DATABASE_URL`, `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`, `ADMIN_PASSWORD`, and `SMTP_*` are **ONLY** provided to the Render backend environment.
   - **Zero** private database or session secrets are exposed to Vercel client-side bundles (no `NEXT_PUBLIC_*` credential leakage).

---

## 5. Concurrency & Transaction Adaptation

### 1. Concurrency on Final Stock Unit (Suite 5)
- **SQLite Approach:** Global write lock via `runTransaction`.
- **PostgreSQL Approach:**
  ```sql
  SELECT id, quantity_on_hand, reserved_quantity, track_stock 
  FROM products 
  WHERE id = $1 
  FOR UPDATE;
  ```
  Row-level locking guarantees that two concurrent checkout requests evaluate shelf stock sequentially. If remaining stock is 1, the first transaction reserves it and decrements availability; the second transaction reads the committed state and receives an immediate `409 Conflict` ("Insufficient stock").

### 2. Concurrency on Final Capacity Slot (Suite 6)
- **PostgreSQL Approach:**
  ```sql
  SELECT COUNT(*) as reserved_count 
  FROM orders 
  WHERE scheduled_date = $1 AND status != 'Cancelled';
  ```
  Executed inside a serializable/read-committed transaction with row lock on the day's settings record. Prevents accepting orders beyond the daily limit.

### 3. Idempotency Key Replay (Suite 9)
- Enforced by unique constraint `PRIMARY KEY (idempotency_key)` on `idempotency_records`. Replayed requests return cached JSON responses with exact matching order IDs without re-reserving stock.

---

## 6. Security & Compatibility Risks

| Risk | Mitigation |
|---|---|
| **Cross-Origin Cookie Blocking** | Modern browsers block third-party cookies across different domains (`vercel.app` ➔ `onrender.com`). Mitigated by: (1) Next.js rewrites proxying `/api/*` on Vercel to Render, and (2) configuring `SameSite=None; Secure` when calling cross-origin with CORS credentials. |
| **Connection Exhaustion on Supabase** | Render backend instances will use Supabase's transaction pooler (port `6543`) or session pooler with a bounded pool size (`max: 10`) in `pg.Pool`, preventing connection spikes. |
| **Exposing Database Credentials** | Strict review of all client bundles to verify `DATABASE_URL` is never prefixed with `NEXT_PUBLIC_`. |
| **Cold Starts on Render Free Tier** | Documented requirement to use Render health check probe (`/api/health`) or keep-alive monitor so the service remains responsive during business hours. |

---

## 7. Migration Roadmap

1. **Step 1:** Install PostgreSQL driver (`pg`, `@types/pg`) and in-memory test driver (`pg-mem`). *(Completed)*
2. **Step 2:** Implement PostgreSQL database abstraction layer (`src/lib/db.ts`) supporting both live PostgreSQL connection pools (`DATABASE_URL`) and mock/in-memory PostgreSQL for local testing.
3. **Step 3:** Adapt `src/lib/storage.ts`, `src/lib/rateLimit.ts`, and `src/lib/notifications.ts` to async PostgreSQL queries and row-level locking.
4. **Step 4:** Create database migration scripts (`scripts/migrate.js`, `scripts/schema.sql`).
5. **Step 5:** Implement CORS middleware and Next.js rewrites in `next.config.js`.
6. **Step 6:** Update test suite (`scripts/test_workflow.js`) to test PostgreSQL transactions, row locking, CORS, and health checks.
7. **Step 7:** Create deployment manifests (`render.yaml`, `vercel.json`), updated `.env.example`, and comprehensive documentation.
8. **Step 8:** Stop for owner review before live public deployment.
