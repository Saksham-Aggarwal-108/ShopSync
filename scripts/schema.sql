-- ============================================================================
-- ShopSync PostgreSQL Production Schema
-- Designed for Supabase / Managed PostgreSQL
-- ============================================================================

-- 0. Schema Migrations Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Store Settings & Capacity Invariants
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
  time_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  reservation_ttl_minutes INTEGER NOT NULL DEFAULT 120
);

-- 2. Products & Inventory
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

-- 3. Customer Orders & Fulfilment
CREATE TABLE IF NOT EXISTS orders (
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
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  customer_notes TEXT,
  admin_notes TEXT,
  cancellation_reason TEXT,
  reservation_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Customer Enquiries
CREATE TABLE IF NOT EXISTS enquiries (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Outbox Notifications & Delivery Status
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

-- 6. Idempotency Records
CREATE TABLE IF NOT EXISTS idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Multi-Instance Rate Limits
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  points INTEGER NOT NULL,
  expire_at BIGINT NOT NULL
);

-- Indexes for Concurrency & Query Performance
CREATE INDEX IF NOT EXISTS idx_orders_scheduled ON orders(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(order_number, tracking_token);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expire ON rate_limits(expire_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_scope ON idempotency_records(scope);

-- Baseline Migration Audit Record
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20261016_phase6_postgresql_init', 'Initial Phase 6 PostgreSQL schema for ShopSync (Vercel + Render + Supabase)', NOW())
ON CONFLICT (version) DO NOTHING;
