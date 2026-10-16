# ShopSync — Deployment Guide: Vercel + Render + Supabase

## 1. Overview & Architecture

ShopSync has transitioned from a single-container SQLite architecture to an enterprise three-tier cloud deployment:

```
┌─────────────────────────┐          ┌───────────────────────────┐          ┌────────────────────────────┐
│         VERCEL          │          │          RENDER           │          │          SUPABASE          │
│   (Frontend Host)       │          │     (Backend API)         │          │     (Managed Database)     │
│                         │          │                           │          │                            │
│  - Next.js 14 App       │          │  - Node.js Web Service    │          │  - Managed PostgreSQL 15+  │
│  - Storefront UI        │  HTTP /  │  - Next.js API Routes     │  TCP/SSL │  - Connection Pooling      │
│  - Admin Dashboard UI   │  Proxy   │  - Auth & PBKDF2 Sessions │  Port    │    (PgBouncer port 6543)   │
│  - Reverse Proxy        ├─────────►│  - Rate Limiter (Atomic)  ├─────────►│  - Direct connection: 5432 │
│    (/api/* -> Render)   │          │  - Concurrency Locking    │          │  - Row-Level Locking       │
│                         │          │  - Outbox Notifications   │          │  - Automated PITR Backups  │
└─────────────────────────┘          └───────────────────────────┘          └────────────────────────────┘
```

---

## 2. Step 1: Supabase PostgreSQL Setup

### A. Create Project
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project** and select your organization.
3. Configure project details:
   - **Name:** `shopsync-db` (or `shopsync-db-staging` for staging)
   - **Database Password:** Click **Generate a password** and securely store this in your password manager.
   - **Region:** Choose the region closest to your customers and your Render backend (e.g., `Frankfurt (eu-central-1)` or `N. Virginia (us-east-1)`).
   - **Pricing Plan:** Free tier or Pro.
4. Click **Create new project** and wait ~2 minutes for provisioning to finish.

### B. Obtain Connection String
1. In the Supabase project dashboard, navigate to **Project Settings** (gear icon) -> **Database**.
2. Scroll to the **Connection string** section.
3. Select the **URI** tab:
   - **Connection Pooling (Recommended for Render persistent service):**
     ```text
     postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - **Direct Connection:**
     ```text
     postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
     ```
4. Replace `[YOUR-PASSWORD]` with the actual database password generated in Step A.
5. **CRITICAL SECURITY BOUNDARY:** Never paste this connection string into frontend environment variables or client repositories. It must be provided strictly server-side on Render.

### C. Run Schema Migration
You can apply the schema migrations through either method:

**Method 1: Supabase SQL Editor (Fastest)**
1. In Supabase Dashboard, click **SQL Editor** from the left navigation bar.
2. Click **New Query**.
3. Open `scripts/schema.sql` in this repository, copy its entire contents, paste it into the editor, and click **Run**.
4. You will see success confirmations creating all 7 core tables and indexes (`settings`, `products`, `orders`, `enquiries`, `notification_logs`, `idempotency_records`, `rate_limits`).

**Method 2: Command Line Migration Script**
Run the automated migration runner using your connection string:
```bash
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" node scripts/migrate.js
```
The script automatically applies `schema.sql`, records the migration version in `schema_migrations`, and seeds initial settings and artisan products.

---

## 3. Step 2: Render Backend Web Service Setup

### A. Create Web Service
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your Git repository containing the ShopSync source code.
4. Configure service settings:
   - **Name:** `shopsync-api`
   - **Runtime:** `Node`
   - **Region:** Match your Supabase region (e.g. Frankfurt or Ohio).
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npx next start -p $PORT -H 0.0.0.0`
   - **Plan:** `Starter` ($7/mo) or `Free` (Note: Starter is recommended to prevent cold-start delays on order webhooks).

### B. Health Check Configuration
1. Under **Advanced Settings**, find **Health Check Path**.
2. Enter: `/api/health`
3. Render will poll this endpoint before routing traffic to a new deployment. The endpoint verifies database responsiveness (`SELECT 1`) while shielding internal diagnostics from public inspection.

### C. Configure Environment Variables on Render
Under the **Environment** tab, add the following variables:

| Variable Name | Example / Production Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production mode |
| `PORT` | `10000` | Render assigns `$PORT` automatically; Next.js binds to `0.0.0.0:$PORT` |
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pw]@...:6543/postgres?pgbouncer=true` | Obtained from Supabase |
| `DATABASE_SSL` | `true` | Enforces SSL encryption in transit |
| `DB_POOL_MAX` | `10` | Max client connections in pool |
| `ADMIN_EMAIL` | `admin@greenwood.local` | Shopkeeper login email |
| `ADMIN_PASSWORD` | *(Strong 32+ character passphrase)* | Replaces default password |
| `SESSION_SECRET` | *(Random 64-character hex string)* | Generate with: `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |
| `STRICT_PRODUCTION_SECRETS` | `true` | Rejects insecure default credentials |
| `FRONTEND_URL` | `https://shopsync.vercel.app` | Your Vercel frontend production URL |
| `ALLOWED_ORIGINS` | `https://shopsync.vercel.app,http://localhost:3000` | Allowed CORS origins for CSRF protection |
| `CROSS_ORIGIN_COOKIES` | `false` | Set `false` when Vercel proxy rewrite is used |
| `SMTP_HOST` | *(Empty)* | Keep empty for simulated email outbox |

Click **Save Changes** and deploy the service. Note your Render URL: `https://shopsync-api.onrender.com`.

---

## 4. Step 3: Vercel Frontend Deployment

### A. Import Project to Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Select the same Git repository.
4. Configure framework preset:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

### B. Configure Environment Variables on Vercel
Add the following variable in the Vercel project settings:

| Variable Name | Production Value | Notes |
| :--- | :--- | :--- |
| `BACKEND_API_URL` | `https://shopsync-api.onrender.com` | Render API web service URL |

### C. How the Vercel Proxy Rewrite Works
`next.config.js` includes the following rewrite rule:
```javascript
async rewrites() {
  const backendApiUrl = process.env.BACKEND_API_URL;
  if (backendApiUrl) {
    return [
      {
        source: '/api/:path*',
        destination: `${backendApiUrl.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  }
  return [];
}
```
**Benefits:**
- **Zero CORS issues:** Browsers send requests to `https://shopsync.vercel.app/api/...`. Vercel's edge network proxies requests to Render over HTTPS.
- **First-party cookies:** The browser treats session cookies as same-origin (`SameSite=Lax`), preventing third-party cookie blocking in Safari (ITP) and Chrome.
- **Single domain:** End users interact with a single branded domain.

---

## 5. Security & Invariant Verification

Before accepting customer traffic, verify the following invariants:

1. **Health Check:**
   ```bash
   curl -i https://shopsync-api.onrender.com/api/health
   # Expected: HTTP 200 {"status":"healthy", "uptimeSec":...}
   # Verify NO internal database hostnames, credentials, or engine versions are leaked.
   ```
2. **CORS & CSRF Origin Protection:**
   ```bash
   curl -i -X PATCH https://shopsync-api.onrender.com/api/store \
     -H "Origin: https://evil-attacker.example.com" \
     -H "Content-Type: application/json" \
     -d '{"dailyCapacity": 99}'
   # Expected: HTTP 403 Forbidden (Blocked by CSRF protection)
   ```
3. **Rate Limiting:**
   Rapid bursts to `/api/auth/login` (11 requests in 10 seconds) will trigger HTTP 429 Too Many Requests with a `Retry-After` header.
4. **Order Tracking Security:**
   Orders require valid tracking tokens (`?token=tr_...`). Accessing tracking without a token returns HTTP 401; administrative notes are sanitized.

---

## 6. Safe Rollback Procedures

### A. Rolling Back Frontend Code (Vercel)
1. Go to **Deployments** in the Vercel Dashboard.
2. Select the previous stable deployment.
3. Click the three dots -> **Promote to Production**. Instant rollback takes effect in < 5 seconds.

### B. Rolling Back Backend API Code (Render)
1. Go to **Deploys** in the Render Dashboard.
2. Select the previous successful deploy commit.
3. Click **Rollback to this deploy**.

### C. Database Recovery (Supabase)
1. Point-in-time recovery (PITR) is accessible under **Project Settings** -> **Backups**.
2. Select a restore timestamp prior to the unintended write.
3. Alternatively, restore from a verified JSON snapshot backup using:
   ```bash
   node scripts/restore.js data/backups/shopsync_pg_backup_[timestamp].json --confirm-overwrite-live
   ```
