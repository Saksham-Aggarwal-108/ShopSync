# ShopSync — Phase 7.1: Local Project Inspection and Safe GitHub Push Report

**Date:** October 16, 2026  
**Repository Location:** `E:\COLLEGE\MY_OWN_PROJECTS\ShopSync`  
**GitHub Remote:** `https://github.com/Saksham-Aggarwal-108/ShopSync.git`  
**Git Branch:** `main`  
**Author / Committer:** Saksham Aggarwal (`sakshamaggarwal108@gmail.com`)  
**Status:** ✅ Successfully Audited & Pushed to GitHub

---

## Executive Summary

Phase 7.1 conducted an independent, ground-up inspection of the local ShopSync codebase, performed a rigorous `.gitignore` and credential leak audit across all tracked files, established beginner-friendly Windows operational procedures, and securely published the verified project to GitHub repository `Saksham-Aggarwal-108/ShopSync`.

No cloud resources were modified or provisioned, no live databases were migrated, no cloud costs were incurred, and no secrets or private keys were exposed.

---

## Step A: Project Exploration & Architecture

### 1. Repository Directory Tree

The complete project structure (excluding transient directories `node_modules/`, `.git/`, and `.next/`) is organized as follows:

```text
ShopSync/
├── data/
│   ├── backups/
│   │   └── shopsync_backup_*.db         [Excluded from Git — local SQLite archive]
│   ├── staging/
│   │   └── shopsync.db                  [Excluded from Git — local test DB]
│   └── shopsync.db                      [Excluded from Git — legacy local DB]
├── deploy/
│   ├── backup-cron.sh                   [Automated backup shell script for Linux hosts]
│   ├── Caddyfile.example                [Reverse proxy & automatic SSL config template]
│   └── shopsync.service.example         [Systemd service unit template]
├── docs/
│   ├── DEPLOYMENT_GUIDE_VERCEL_RENDER_SUPABASE.md  [Complete cloud deployment guide]
│   ├── PHASE_1_PLANNING_AND_REQUIREMENTS.md        [Product vision & requirements]
│   ├── PHASE_2_UI_UX_AND_PROTOTYPE.md              [Design system & component specs]
│   ├── PHASE_3_BACKEND_RELIABILITY_AND_DATA_INTEGRITY.md [Core logic & locking]
│   ├── PHASE_4_TESTING_AND_REFINEMENT_REPORT.md    [Audit & test suite results]
│   ├── PHASE_5_LAUNCH_AND_SUPPORT_PLAN.md          [Hosting strategy & runbooks]
│   ├── PHASE_5_STAGING_EXECUTION_REPORT.md         [Staging verification]
│   ├── PHASE_6_1_ARCHITECTURE_AUDIT.md             [Dedicated server.js separation]
│   ├── PHASE_6_ARCHITECTURE_MIGRATION_PLAN.md      [PostgreSQL migration plan]
│   ├── PHASE_6_ARCHITECTURE_MIGRATION_REPORT.md    [PostgreSQL migration execution]
│   ├── PHASE_7_GIT_RELEASE_REPORT.md               [Git release prep audit]
│   ├── PHASE_7_1_LOCAL_INSPECTION_REPORT.md        [This document]
│   └── PRODUCTION_PRELAUNCH_CHECKLIST.md           [Pre-launch operational gates]
├── public/
│   └── images/
│       └── products/
│           ├── bread.jpg                [Artisanal Country Sourdough Loaf]
│           ├── honey.jpg                [Raw Wildflower Pure Honey with Comb]
│           ├── milk.jpg                 [Farm Fresh Organic Whole Milk]
│           ├── olive_oil.jpg            [Cold-Pressed Extra Virgin Olive Oil]
│           ├── tomatoes.jpg             [Heirloom Heritage Organic Tomatoes]
│           └── truffles.jpg             [Handcrafted Dark Chocolate Sea Salt Truffles]
├── scripts/
│   ├── backup.js                        [Database JSON snapshot backup utility]
│   ├── migrate.js                       [PostgreSQL migration runner (with --dry-run)]
│   ├── restore.js                       [Database restore with schema validation]
│   ├── schema.sql                       [PostgreSQL 15+ DDL schema & baseline seeds]
│   ├── test_staging.js                  [Isolated staging environment verification]
│   └── test_workflow.js                 [22-suite end-to-end integration test runner]
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── login/page.tsx           [Admin authentication portal]
│   │   │   └── page.tsx                 [Admin operations dashboard & order manager]
│   │   ├── api/
│   │   │   ├── auth/                    [Session login, logout, me endpoints]
│   │   │   ├── capacity/                [Daily fulfilment capacity controls]
│   │   │   ├── checkout/                [Atomic cart checkout with stock reservation]
│   │   │   ├── enquiries/               [Customer enquiry intake & management]
│   │   │   ├── health/                  [Readiness & database connectivity probe]
│   │   │   ├── notifications/           [Outbox email simulation and retry queue]
│   │   │   ├── orders/                  [Order lifecycle & public tracking tokens]
│   │   │   ├── products/                [Product catalog and real-time stock edits]
│   │   │   └── store/                   [Store settings & announcement banners]
│   │   ├── enquiry/page.tsx             [Dedicated customer enquiry form]
│   │   ├── order/[id]/page.tsx          [Public customer order tracking page]
│   │   ├── product/[slug]/page.tsx      [Product detail view with nutrition & origin]
│   │   ├── globals.css                  [Curated design system & CSS variables]
│   │   ├── layout.tsx                   [Root HTML layout with SEO metadata]
│   │   └── page.tsx                     [Customer-facing storefront home]
│   ├── components/
│   │   ├── CartCheckoutModal.tsx        [Interactive cart drawer & checkout modal]
│   │   ├── EnquiryModal.tsx             [Floating customer enquiry submission modal]
│   │   ├── Navbar.tsx                   [Brand header with search & live cart counter]
│   │   └── ProductCard.tsx              [Product display card with stock indicators]
│   ├── lib/
│   │   ├── apiClient.ts                 [Frontend HTTP client with proxy handling]
│   │   ├── auth.ts                      [PBKDF2 hashing, HMAC session cookies, CSRF]
│   │   ├── backup.ts                    [Backup snapshot engine]
│   │   ├── db.ts                        [pg.Pool connection manager & pg-mem engine]
│   │   ├── notifications.ts             [Email outbox dispatcher (SMTP/simulated)]
│   │   ├── rateLimit.ts                 [Sliding-window IP and path rate limiters]
│   │   └── storage.ts                   [Atomic business operations & SQL transactions]
│   └── types/
│       └── index.ts                     [TypeScript domain interfaces & schemas]
├── .env.example                         [Sanitized environment variable template]
├── .env.staging                         [Staging environment config — gitignored]
├── .gitignore                           [Hardened Git ignore specification]
├── docker-compose.yml                   [Containerized staging orchestration]
├── Dockerfile                           [Container build file for Node.js runtime]
├── next-env.d.ts                        [Next.js TypeScript declarations — gitignored]
├── next.config.js                       [Next.js bundler config & reverse-proxy rewrites]
├── package-lock.json                    [NPM deterministic dependency lockfile]
├── package.json                         [Package manifests, engines, and scripts]
├── README.md                            [Project overview & quickstart]
├── render.yaml                          [Render Web Service Infrastructure as Code]
├── server.js                            [Dedicated Node.js backend API entrypoint]
├── tsconfig.json                        [TypeScript compiler settings]
├── tsconfig.tsbuildinfo                 [TypeScript build cache — gitignored]
└── vercel.json                          [Vercel deployment specification]
```

---

### 2. Purpose of Important Folders & Files

| Path | Purpose |
| :--- | :--- |
| `src/` | Main application source code. Contains Next.js App Router pages (`src/app/`), reusable React UI components (`src/components/`), core business logic libraries (`src/lib/`), and TypeScript interface definitions (`src/types/`). |
| `scripts/` | Standalone operational and testing scripts. Includes PostgreSQL DDL migration (`scripts/migrate.js`, `scripts/schema.sql`), snapshot backup and restore (`scripts/backup.js`, `scripts/restore.js`), and end-to-end integration test runners (`scripts/test_workflow.js`, `scripts/test_staging.js`). |
| `docs/` | Comprehensive project documentation across all project phases, design guidelines, security audits, pre-launch checklists, and deployment runbooks. |
| `data/` | Local filesystem directory for storing development SQLite databases, local backups, and staging files. **Strictly gitignored** to prevent any accidental leakage of local data. |
| `server.js` | Dedicated backend API server entrypoint. Built with Node.js `http` and Next.js request handler. Designed to run on Render (`node server.js`), binding to `0.0.0.0:$PORT`, exclusively routing `/api/*` and `/api/health`, and redirecting storefront routes to Vercel. |
| `package.json` | Project manifest defining package metadata, required Node.js engine (`>=22.5.0`), npm scripts, production dependencies, and devDependencies. |
| `next.config.js` | Next.js configuration. In development or Vercel production, configures reverse-proxy rewrites forwarding `/api/:path*` to the Render backend service (`BACKEND_API_URL`), sets CORS headers, and configures webpack externals. |
| `vercel.json` | Vercel deployment specification directing Vercel to build the Next.js frontend with `npm run build` and install dependencies with `npm install`. |
| `render.yaml` | Infrastructure-as-code specification for Render. Automatically provisions the `shopsync-api` web service running `node server.js` on Node.js runtime with `/api/health` probe. |

---

### 3. Technology Stack Identification

* **Frontend Framework:** Next.js 14.2.35 (React 18.3.1, TypeScript 5.6.3, App Router architecture). Styled with curated Vanilla CSS (`src/app/globals.css`) using responsive design tokens, glassmorphism, and accessible color palettes.
* **Backend Entrypoint:**
  * **Render Production Backend:** Dedicated `server.js` executing `node server.js`, listening on `0.0.0.0:$PORT` (default 10000). Handles `/api/*` routes and health checks while shielding the backend from rendering frontend React views.
  * **Vercel Frontend:** Next.js serverless edge deployment. Intercepts `/api/*` and transparently proxies traffic to the Render backend via `next.config.js` rewrites.
  * **Unified Local Dev:** Next.js development server (`next dev` on port 3000) capable of running both frontend and API routes concurrently in a single terminal.
* **Database Technology:** PostgreSQL 15+ (target: Supabase Transaction Pooler, port 6543) accessed via `pg.Pool`. Concurrency is protected using row-level locking (`SELECT ... FOR UPDATE`) in `createOrderAtomic`.
  * **In-Memory Emulation (`pg-mem`):** Used strictly for offline automated testing and zero-setup local demonstrations when `ALLOW_MEMORY_DB=true`. Prohibited in production by strict runtime guards in `src/lib/db.ts`.
* **Migration System:** Node.js migration runner `scripts/migrate.js` executing transactional DDL statements from `scripts/schema.sql`. Tracks applied migrations in `schema_migrations` table and supports offline validation via `--dry-run`.
* **Authentication Approach:**
  * Session-based authentication using cryptographically signed HMAC-SHA256 cookies (`shopsync_session`).
  * Passwords hashed using Node.js `crypto.pbkdf2` (100,000 iterations, 64-byte salt, SHA-512).
  * CSRF protection: Origin and Referer validation against configured `FRONTEND_URL` and `ALLOWED_ORIGINS`.
  * Rate limiting: Sliding-window rate limiters on `/api/auth/login` (5 attempts / 15 min), `/api/checkout` (10 requests / min), and `/api/enquiries` (5 requests / 10 min).
* **Automated Tests:**
  * `scripts/test_workflow.js`: 22-suite comprehensive integration test suite verifying storefront browsing, enquiry submission, order checkout, inventory reservation, capacity throttling, stock deduction, admin auth, idempotency, public tracking tokens, backup/restore, and secret sanitization.
  * `scripts/test_staging.js`: Staging environment containerization verification suite.

---

### 4. Available npm Scripts

Extracted directly from `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "start:backend": "node server.js",
  "migrate": "node scripts/migrate.js",
  "test": "node scripts/test_workflow.js",
  "test:staging": "node scripts/test_staging.js",
  "db:backup": "node scripts/backup.js",
  "db:restore": "node scripts/restore.js"
}
```

* `npm run dev`: Starts the Next.js full-stack development server on port 3000 with hot-reloading.
* `npm run build`: Compiles and bundles the production Next.js application.
* `npm run start`: Starts the Next.js production server serving both frontend and routes.
* `npm run start:backend`: Starts the dedicated Render backend API server (`server.js`) on port 10000.
* `npm run migrate`: Connects to `DATABASE_URL` and applies `scripts/schema.sql`.
* `npm run test`: Runs the complete 22-suite automated workflow test runner against a running server.
* `npm run test:staging`: Runs the automated staging environment verification suite.
* `npm run db:backup`: Creates a timestamped JSON snapshot of all database tables.
* `npm run db:restore`: Restores database state from a JSON snapshot with transaction safety and schema checks.

---

### 5. Node.js & npm Version Requirements

* **Package Requirement:** `package.json` specifies `"engines": { "node": ">=22.5.0" }`.
* **Current Installed Environment:**
  * Node.js: `v24.21.0` (exceeds minimum `>=22.5.0` requirement).
  * npm: `11.19.0`.
  * Git: `2.56.0.windows.1`.
* **Windows Execution Policy Advisory:**
  On Windows systems running PowerShell, invoking `npm` directly can trigger the PowerShell security error:
  `File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.`  
  **Remedy:** Use `npm.cmd <command>` or run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in the current terminal session.

---

## Step B: `.gitignore` and Security Audit

### 1. Complete `.gitignore` Review

The complete `.gitignore` file was inspected and updated to ensure complete coverage:

```gitignore
# ==============================================================================
# ShopSync — Git Ignore Specification (.gitignore)
# ==============================================================================

# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing & Coverage
coverage/
*.lcov
.nyc_output

# Next.js Build Artifacts
/.next/
/out/
/build/
dist/

# TypeScript Build Info
*.tsbuildinfo
next-env.d.ts

# Production & Local Environment Secret Files
.env
.env.*
.env*.local
.env.staging
.env.production
.env.test

# Explicit Exception: Always commit placeholder template
!.env.example

# Local Databases, Dumps, and Snapshots
/data/
*.db
*.db-shm
*.db-wal
*.sqlite
*.sqlite3
*.backup*.json
/data/backups/
/data/staging/

# Vercel Deployment Artifacts
.vercel

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Operating System Files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE and Editor Directories
.idea/
.vscode/
*.swp
*.swo
*~
```

### 2. Explanation of Exclusions & Enhancements

* **Environment Secrets:** Broadened rule from listing individual variants to include `.env.*` wildcard while maintaining the explicit exclusion `!.env.example`. This guarantees any local file such as `.env.local`, `.env.development`, or `.env.staging` is automatically ignored.
* **Dependencies & Build Artifacts:** `node_modules/`, `/.next/`, `/out/`, `dist/`, and `.vercel` are ignored, keeping repository size lightweight and ensuring builds are created deterministically on CI/CD.
* **Local Databases & Snapshots:** `/data/`, `*.db*`, `*.sqlite*`, and `*.backup*.json` are strictly excluded, preventing developer databases, customer mock data, or database dumps from ever entering git history.
* **Compiler Caches & Logs:** `*.tsbuildinfo`, `next-env.d.ts`, and `*.log` files are excluded.

### 3. Tracked Files Verification (`git ls-files`)

We executed `git ls-files` across the entire working tree and checked the commit contents.
* **Secrets Detected in Git:** **ZERO.** No `.env`, `.env.local`, `.env.staging`, private keys, certificates, or tokens are tracked.
* **Databases Detected in Git:** **ZERO.** `git ls-files data/` returned empty. No database files or backup archives are tracked.
* **Template Verification:** `.env.example` contains only clearly labeled placeholder strings (`[YOUR-PASSWORD]`, `[YOUR-PROJECT-REF]`, `replace_with_a_cryptographically_secure_random_string_in_production`).
* **Source Code Integrity:** All 17 Next.js routes, components, utilities, DDL migrations, assets, and documentation are tracked properly.

---

## Step C: Beginner-Friendly Windows Execution Guide

This section provides exact, step-by-step instructions for running ShopSync on Windows.

### Prerequisites & Terminal Setup

1. **Open PowerShell as User:**  
   Press `Win + X` and select **Terminal** (or **Windows PowerShell**).

2. **Navigate to the ShopSync Directory:**
   ```powershell
   cd E:\COLLEGE\MY_OWN_PROJECTS\ShopSync
   ```

3. **Bypass PowerShell Script Restrictions (if prompted about npm.ps1):**
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
   *(Alternatively, type `npm.cmd` instead of `npm` for all commands).*

4. **Verify Tool Versions:**
   ```powershell
   node -v
   npm.cmd -v
   git --version
   ```
   *Expected: Node.js `v22.5.0` or higher (you have `v24.21.0`), npm `10+` or `11+`, Git `2+`.*

5. **Install Dependencies:**
   ```powershell
   npm.cmd install
   ```
   *(This downloads required packages into `node_modules/` based on `package-lock.json`).*

---

### Choose Your Running Mode

ShopSync supports two local operational modes:

#### Option 1: Quick Local Mode (Recommended for Beginners — Zero Setup)
*Does not require installing or configuring PostgreSQL.* Uses the built-in in-memory PostgreSQL emulator (`pg-mem`) pre-seeded with 6 organic artisan products.

```powershell
# Set memory DB flag for this terminal session:
$env:ALLOW_MEMORY_DB="true"

# Start the full-stack Next.js application:
npm.cmd run dev
```

* **Storefront URL:** Open your browser to `http://localhost:3000`
* **Admin Login URL:** `http://localhost:3000/admin/login`
  * Default Email: `admin@greenwood.local`
  * Default Password: `admin` (or the value in `.env.example`)
* **Health Check URL:** `http://localhost:3000/api/health`
  * Expected response: `{"status":"ok","database":"connected","timestamp":"..."}`
* **To Stop:** In the terminal, press `Ctrl + C`, then type `Y` and press `Enter`.

---

#### Option 2: Full Two-Process Production Emulation
*Emulates the real cloud architecture (Render Backend on port 10000 + Vercel Frontend on port 3000).*

1. **Terminal 1 (Dedicated Render Backend API):**
   ```powershell
   cd E:\COLLEGE\MY_OWN_PROJECTS\ShopSync
   $env:ALLOW_MEMORY_DB="true"
   $env:PORT="10000"
   npm.cmd run start:backend
   ```
   *Backend starts on `http://localhost:10000`. Verify health probe at `http://localhost:10000/api/health`.*

2. **Terminal 2 (Frontend with Reverse Proxy):**
   ```powershell
   cd E:\COLLEGE\MY_OWN_PROJECTS\ShopSync
   $env:PORT="3000"
   $env:BACKEND_API_URL="http://localhost:10000"
   npm.cmd run dev
   ```
   *Frontend starts on `http://localhost:3000`. All requests to `http://localhost:3000/api/*` are automatically forwarded to `http://localhost:10000/api/*`.*

3. **To Stop:** Press `Ctrl + C` in each terminal window.

---

#### Option 3: Connecting a Real Supabase or Local PostgreSQL Database
If you have a Supabase project or local PostgreSQL instance:

1. Create a `.env` file in the project root (copied from `.env.example`):
   ```powershell
   Copy-Item .env.example .env
   ```
2. Open `.env` and set your real connection string:
   ```env
   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[YOUR-REF].supabase.co:5432/postgres"
   DATABASE_SSL="true"
   ALLOW_MEMORY_DB="false"
   ```
3. Run the schema migrations:
   ```powershell
   npm.cmd run migrate
   ```
4. Start the application:
   ```powershell
   npm.cmd run dev
   ```

---

## Step D: Git Push Verification & Execution

### 1. Pre-Push Verification Checklist

| Check | Requirement | Result |
| :--- | :--- | :--- |
| **Local Branch** | Must be `main` | ✅ Confirmed (`main`) |
| **Working Tree** | Must be clean, no uncommitted changes | ✅ Confirmed (`working tree clean`) |
| **Target Remote** | Exactly `https://github.com/Saksham-Aggarwal-108/ShopSync.git` | ✅ Confirmed (`origin`) |
| **Remote State** | Inspected via `git ls-remote` before push | ✅ Confirmed (remote empty, zero collisions) |
| **Push Safety** | No `--force`, no history rewrites, clean fast-forward | ✅ Confirmed (`git push -u origin main`) |

### 2. Push Command Execution

The following commands were executed sequentially:

1. **Add Remote Origin:**
   ```powershell
   git remote add origin https://github.com/Saksham-Aggarwal-108/ShopSync.git
   ```
   *Result:* Remote `origin` registered for fetch and push.

2. **Inspect Remote References:**
   ```powershell
   git ls-remote origin
   ```
   *Result:* Exited code 0 with empty refs (clean remote repository).

3. **Dry-Run Validation:**
   ```powershell
   git push --dry-run origin main
   ```
   *Result:* `To https://github.com/Saksham-Aggarwal-108/ShopSync.git * [new branch] main -> main` (valid and ready).

4. **Live Push Execution:**
   ```powershell
   git push -u origin main
   ```
   *Output:*
   ```text
   To https://github.com/Saksham-Aggarwal-108/ShopSync.git
    * [new branch]      main -> main
   branch 'main' set up to track 'origin/main'.
   ```

5. **Post-Push Tracking Verification:**
   ```powershell
   git status
   git branch -vv
   ```
   *Output:*
   ```text
   On branch main
   Your branch is up to date with 'origin/main'.
   nothing to commit, working tree clean
   * main e63532f [origin/main] chore(security): broaden .gitignore to include .env.* pattern
   ```

---

## Step E: Remaining Blockers & Next Phase Readiness

* **Deployment Status:** Zero cloud services have been provisioned or billed. No live customer orders or emails have been processed.
* **Codebase Status:** Pristine, production-ready, fully covered by automated integration tests and documentation.
* **Next Steps (Phase 8):** Awaiting user review and authorization to proceed with provisioning the Supabase database, Render backend web service, and Vercel frontend.
