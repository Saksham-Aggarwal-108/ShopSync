# ShopSync — Production Pre-Launch Checklist

This checklist must be systematically completed and verified before directing public customer traffic or switching from staging to production.

---

## 1. Hosting Infrastructure & Tier Verification

- [ ] **Supabase PostgreSQL Database Provisioned:**
  - [ ] Dedicated production Supabase project created (isolated from staging and local development).
  - [ ] Strong random database master password generated and stored in a team secret vault.
  - [ ] Direct URI (`5432`) and Connection Pooling URI (`6543`, PgBouncer) obtained.
  - [ ] Automated Point-In-Time-Recovery (PITR) and daily backups enabled in Supabase.
- [ ] **Render Web Service Provisioned:**
  - [ ] Service name: `shopsync-api`
  - [ ] Runtime: `Node.js` (Engine >= 22.5.0 LTS)
  - [ ] Region matched with Supabase (e.g., Frankfurt / Frankfurt).
  - [ ] Instance type: `Starter` ($7/mo) or higher to prevent cold-start request dropped spikes.
  - [ ] Health check path set to `/api/health`.
- [ ] **Vercel Frontend Project Provisioned:**
  - [ ] Project connected to GitHub repository main branch.
  - [ ] Framework preset: `Next.js`.
  - [ ] Build command: `npm run build`.

---

## 2. Environment Variables & Secret Hardening

### Render Web Service (Backend API)
- [ ] `NODE_ENV=production`
- [ ] `PORT=10000` (or Render default)
- [ ] `DATABASE_URL` configured with Supabase connection pooling string.
- [ ] `DATABASE_SSL=true` (enforces TLS encryption in transit).
- [ ] `DB_POOL_MAX=10`
- [ ] `ADMIN_EMAIL` configured for the physical shop owner.
- [ ] `ADMIN_PASSWORD` configured with a cryptographically strong, non-default passphrase (>= 32 chars).
- [ ] `SESSION_SECRET` configured with a 64-character random hex string (`crypto.randomBytes(32).toString('hex')`).
- [ ] `STRICT_PRODUCTION_SECRETS=true` (enforced at application boot; rejects default demo credentials).
- [ ] `FRONTEND_URL` configured to the primary Vercel production URL (e.g., `https://shopsync.vercel.app`).
- [ ] `ALLOWED_ORIGINS` configured with allowed frontend domains for CSRF protection.
- [ ] `CROSS_ORIGIN_COOKIES=false` (using Vercel reverse proxy rewrite for same-origin cookies).

### Vercel Project (Frontend Storefront & Admin)
- [ ] `BACKEND_API_URL` configured to `https://shopsync-api.onrender.com`.
- [ ] **VERIFY ZERO LEAKS:** Confirm that `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` are NEVER added to Vercel environment variables or exposed via `NEXT_PUBLIC_*`.

---

## 3. Database Schema & Migration Verification

- [ ] Applied `scripts/schema.sql` to production Supabase database.
- [ ] Migration recorded in `schema_migrations` table (`version: 20261016_phase6_postgresql_init`).
- [ ] Verified all 7 core tables exist:
  - [ ] `settings` (Row count: 1)
  - [ ] `products` (Initial catalogue active)
  - [ ] `orders`
  - [ ] `enquiries`
  - [ ] `notification_logs`
  - [ ] `idempotency_records`
  - [ ] `rate_limits`
- [ ] Verified unique constraints and indexes:
  - [ ] `idx_orders_scheduled`
  - [ ] `idx_orders_tracking`
  - [ ] `idx_products_slug`
  - [ ] `idx_notifications_status`
  - [ ] `idx_rate_limits_expire`
  - [ ] `idx_idempotency_scope`

---

## 4. Concurrency, Invariants & Security Guardrails

- [ ] **Row-Level Locking (`FOR UPDATE`):**
  - [ ] Verified that concurrent checkouts against the final available stock unit allow exactly one checkout and reject contenders with HTTP 409 without overselling.
- [ ] **Daily Capacity Enforcement:**
  - [ ] Verified that concurrent checkouts for the final daily slot allow exactly one order and reject contenders once capacity is reached.
- [ ] **Reservation Expiry & Auto-Cancellation:**
  - [ ] Pending orders beyond reservation window auto-expire via lazy sweeper; reserved stock is released back to inventory.
- [ ] **Idempotency Protection:**
  - [ ] Orders submitted with `Idempotency-Key` or `x-idempotency-key` return original order without double-booking.
- [ ] **Cross-Site Request Forgery (CSRF):**
  - [ ] Mutation endpoints (`POST`, `PATCH`, `PUT`, `DELETE`) reject untrusted origins with HTTP 403.
- [ ] **Rate Limiting:**
  - [ ] Rapid burst login requests (> 10/min) receive HTTP 429 Too Many Requests with `Retry-After`.
- [ ] **Tracking Endpoint Redaction:**
  - [ ] Public order tracking endpoint requires valid secret token; sensitive shopkeeper notes and credentials are strictly excluded.
- [ ] **Health Probe Sanitization:**
  - [ ] Public `/api/health` probe returns simple `status: healthy` without leaking database host, credentials, or internal query diagnostics.

---

## 5. Notification Outbox & Communications Safety

- [ ] `SMTP_HOST` is initially empty (SIMULATED mode enabled by default).
- [ ] Customer order receipts and enquiry confirmations log to `notification_logs` table with status `SIMULATED`.
- [ ] Zero unsolicited emails sent to real customers during launch rehearsal.
- [ ] Dedicated test transaction performed by shop owner before activating genuine SMTP delivery.

---

## 6. Pre-Launch Emergency Contacts & Rollback Readiness

- [ ] Team aware of instant Vercel rollback procedure (Promote previous deployment).
- [ ] Team aware of Render rollback procedure (Rollback to previous deployment commit).
- [ ] Verified that `scripts/backup.js` and `scripts/restore.js` can export and restore snapshots safely.
- [ ] Rollback authorization criteria established (e.g., > 1% checkout error rate or persistent capacity drift).
