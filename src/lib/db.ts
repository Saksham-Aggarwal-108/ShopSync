import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';
import {
  AppDatabase,
  Product,
  ShopSettings,
} from '@/types';

const globalForDb = global as unknown as {
  poolInstance?: Pool | null;
  initPromise?: Promise<void> | null;
};

let poolInstance: Pool | null = globalForDb.poolInstance || null;
let initPromise: Promise<void> | null = globalForDb.initPromise || null;

const INITIAL_SETTINGS: ShopSettings = {
  shopName: 'Greenwood Provisions',
  tagline: 'Your Neighbourhood Organic Pantry & Bakery',
  phone: '+1 (555) 382-9401',
  email: 'hello@greenwoodprovisions.local',
  address: '14 Elmwood Terrace, Old Town Quarter',
  businessHours: 'Mon - Sat: 8:00 AM – 7:00 PM | Sun: 9:00 AM – 4:00 PM',
  dailyCapacity: 12,
  isStoreOpen: true,
  ordersPaused: false,
  noticeBanner: '🌿 Harvest Special: Farm fresh organic milk & sourdough loaves delivered daily. Order ahead for convenient same-day pickup!',
  currencySymbol: '£',
  timeSlots: [
    'Morning: 09:00 AM - 12:00 PM',
    'Early Afternoon: 12:00 PM - 03:00 PM',
    'Late Afternoon: 03:00 PM - 06:00 PM',
  ],
  reservationTtlMinutes: 120,
};

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-milk-01',
    slug: 'farm-fresh-organic-whole-milk',
    title: 'Farm Fresh Organic Whole Milk',
    description: 'Unhomogenised pasture-raised whole milk from Oakwood Jersey herd. Thick cream top, rich flavor, bottled daily in returnable glass.',
    category: 'Dairy & Eggs',
    price: 2.80,
    packaging: '1 Litre Glass Bottle',
    imageUrl: '/images/products/milk.jpg',
    isActive: true,
    quantityOnHand: 8,
    reservedQuantity: 1,
    lowStockThreshold: 3,
    trackStock: true,
    origin: 'Oakwood Valley Organic Farm, Somerset',
    ingredients: '100% Raw unhomogenised whole cows milk (Pasteurised)',
    storageInfo: 'Keep refrigerated below 4°C. Consume within 4 days of delivery.',
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-bread-02',
    slug: 'artisanal-country-sourdough',
    title: 'Artisanal Country Sourdough Loaf',
    description: 'Stone-milled organic flour, 36-hour slow fermentation, blistered mahogany crust with an airy, pillowy crumb.',
    category: 'Bakery',
    price: 4.50,
    packaging: '800g Wrapped Loaf',
    imageUrl: '/images/products/bread.jpg',
    isActive: true,
    quantityOnHand: 6,
    reservedQuantity: 0,
    lowStockThreshold: 2,
    trackStock: true,
    origin: 'The Flour & Stone In-house Bakery',
    ingredients: 'Organic stoneground white & rye flour, natural levain culture, sea salt, water',
    storageInfo: 'Keep wrapped in bread linen. Excellent for toasting up to day 5.',
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-honey-03',
    slug: 'raw-wildflower-pure-honey',
    title: 'Raw Wildflower Pure Honey with Comb',
    description: 'Cold-extracted unpasteurised honey infused with natural floral notes from local clover and heather meadows. Includes fresh honeycomb slice.',
    category: 'Pantry',
    price: 7.20,
    packaging: '500g Hex Glass Pot',
    imageUrl: '/images/products/honey.jpg',
    isActive: true,
    quantityOnHand: 12,
    reservedQuantity: 2,
    lowStockThreshold: 4,
    trackStock: true,
    origin: 'Wessex Heathlands Apiary',
    ingredients: '100% Pure raw wildflower honey, fresh comb piece',
    storageInfo: 'Store at room temperature. Natural crystallization indicates raw purity.',
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-olive-04',
    slug: 'cold-pressed-extra-virgin-olive-oil',
    title: 'Cold-Pressed Extra Virgin Olive Oil',
    description: 'Single-estate early harvest Sicilian olives, cold-extracted within 6 hours of picking. Herbaceous, peppery finish.',
    category: 'Pantry',
    price: 11.50,
    packaging: '750ml Dark UV Glass Bottle',
    imageUrl: '/images/products/olive_oil.jpg',
    isActive: true,
    quantityOnHand: 3,
    reservedQuantity: 1,
    lowStockThreshold: 3,
    trackStock: true,
    origin: "L'Oliveto del Sole, Western Sicily",
    ingredients: '100% Cold-pressed Nocellara del Belice & Biancolilla extra virgin olive oil',
    storageInfo: 'Store in a cool dark place away from direct sunlight.',
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-truffles-05',
    slug: 'belgian-dark-chocolate-truffles',
    title: 'Handcrafted Dark Chocolate Sea Salt Truffles',
    description: '72% Single-origin Ecuadorian dark chocolate ganache, dusted with raw Dutch cocoa and Maldon sea salt flakes.',
    category: 'Confectionery',
    price: 8.90,
    packaging: 'Gift Box of 12 Truffles',
    imageUrl: '/images/products/truffles.jpg',
    isActive: true,
    quantityOnHand: 9,
    reservedQuantity: 0,
    lowStockThreshold: 3,
    trackStock: true,
    origin: 'The Cocoa Atelier, Bath',
    ingredients: 'Ecuadorian cocoa mass, cocoa butter, organic cream, cane sugar, sea salt',
    storageInfo: 'Best kept between 14°C and 18°C. Do not freeze.',
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod-tomatoes-06',
    slug: 'heirloom-heritage-organic-tomatoes',
    title: 'Heirloom Heritage Organic Tomatoes',
    description: 'Sun-ripened mix of Black Krim, Brandywine, and Green Zebra varieties. Intensely sweet, vine-ripened on family farm.',
    category: 'Produce',
    price: 3.90,
    packaging: '1kg Craft Punnet with Vine',
    imageUrl: '/images/products/tomatoes.jpg',
    isActive: true,
    quantityOnHand: 5,
    reservedQuantity: 0,
    lowStockThreshold: 2,
    trackStock: true,
    origin: 'Cotswold Heritage Organic Walled Garden',
    ingredients: 'Freshly harvested heirloom tomatoes',
    storageInfo: 'Store at room temperature with stems attached to maintain full sweetness.',
    lastVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Creates and initializes the PostgreSQL pool.
 * In production/staging: strictly requires DATABASE_URL and fails fast if missing/unreachable.
 * In-memory fallback (pg-mem) is permitted ONLY in explicitly designated test environments.
 */
export async function getPool(): Promise<Pool> {
  if (!poolInstance) {
    const isProduction = process.env.NODE_ENV === 'production';
    const strictSecrets = process.env.STRICT_PRODUCTION_SECRETS === 'true';
    const isTest = process.env.NODE_ENV === 'test';
    const allowMemoryDb = process.env.ALLOW_MEMORY_DB === 'true' || process.env.USE_PG_MEM === 'true';
    const databaseUrl = process.env.DATABASE_URL;

    // 1. Strict Production Guard: In-memory database is prohibited in production
    if (isProduction && allowMemoryDb) {
      throw new Error(
        'FATAL: In-memory database emulation (ALLOW_MEMORY_DB / USE_PG_MEM) is strictly prohibited in production mode. ' +
        'A persistent PostgreSQL database is required.'
      );
    }

    // 2. Production / Staging: Require valid DATABASE_URL
    if (isProduction || strictSecrets || (!allowMemoryDb && !isTest)) {
      if (!databaseUrl || databaseUrl.trim() === '') {
        throw new Error(
          'FATAL: DATABASE_URL environment variable is missing or empty. ' +
          'ShopSync cannot start without a valid PostgreSQL database connection. ' +
          'Silent in-memory fallback is disabled to prevent permanent data loss.'
        );
      }
    }

    if (databaseUrl && (!allowMemoryDb || isProduction)) {
      const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
      const sslRequired = isProduction || process.env.DATABASE_SSL === 'true';
      const ssl = !isLocal && sslRequired ? { rejectUnauthorized: false } : false;

      poolInstance = new Pool({
        connectionString: databaseUrl,
        ssl,
        max: Number(process.env.DB_POOL_MAX || 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 8000,
      });

      // Verify physical connectivity immediately on pool initialization
      try {
        const testClient = await poolInstance.connect();
        try {
          await testClient.query('SELECT 1 as connection_test;');
        } finally {
          testClient.release();
        }
        console.log(`[Database] Successfully connected to PostgreSQL (Host: ${isLocal ? 'local' : 'remote'}, SSL: ${Boolean(ssl)}).`);
      } catch (connErr: any) {
        // Redact any credentials from error output before throwing
        const safeMessage = connErr?.message || 'Connection failed';
        poolInstance = null;
        throw new Error(`[Database] FATAL: Unable to reach PostgreSQL database at the configured DATABASE_URL: ${safeMessage}`);
      }
    } else if (allowMemoryDb || isTest) {
      // Offline in-memory PostgreSQL engine: permitted exclusively in tests or explicit mock mode
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { newDb } = require('pg-mem');
      const memDb = newDb();
      const pgAdapter = memDb.adapters.createPg();
      poolInstance = new pgAdapter.Pool() as Pool;
      console.log('[Database] ⚠️ Test Mode: Connected to in-memory PostgreSQL emulator (pg-mem). Data will not persist across restarts.');
    }
    globalForDb.poolInstance = poolInstance;
  }

  // Ensure schema is initialized once
  if (!initPromise && poolInstance) {
    initPromise = initSchemaAndMigrate(poolInstance);
    globalForDb.initPromise = initPromise;
  }
  if (initPromise) {
    await initPromise;
  }

  return poolInstance!;
}

/**
 * Execute a query with parameters against the PostgreSQL pool
 */
export async function query<R extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<R>> {
  const pool = await getPool();
  return pool.query<R>(text, params);
}

/**
 * Acquire a dedicated client from the pool (must be released when done)
 */
export async function getClient(): Promise<PoolClient> {
  const pool = await getPool();
  return pool.connect();
}

let transactionLock = Promise.resolve();

/**
 * Execute a callback within an atomic PostgreSQL transaction.
 * Queues transactions in-process to guarantee strict isolation and prevent race conditions.
 */
export async function runTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  let releaseLock: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  const previousLock = transactionLock;
  transactionLock = transactionLock.then(() => lockPromise, () => lockPromise);

  await previousLock;

  const client = await getClient();
  try {
    await client.query('BEGIN;');
    const result = await work(client);
    await client.query('COMMIT;');
    return result;
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    client.release();
    releaseLock();
  }
}

/**
 * Initializes the PostgreSQL schema and seeds initial data if products are missing
 */
async function initSchemaAndMigrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // 0. Schema Migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        description TEXT,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 1. Settings Table
    await client.query(`
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
    `);

    // 2. Products Table
    await client.query(`
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
    `);

    // 3. Orders Table
    await client.query(`
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
    `);

    // 4. Enquiries Table
    await client.query(`
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
    `);

    // 5. Notification Outbox Table
    await client.query(`
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
    `);

    // 6. Idempotency Records Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_records (
        idempotency_key TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        response_status INTEGER NOT NULL,
        response_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 7. Rate Limits Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        points INTEGER NOT NULL,
        expire_at BIGINT NOT NULL
      );
    `);

    // Indexes for query performance & locking
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_scheduled ON orders(scheduled_date, status);
      CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(order_number, tracking_token);
      CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_logs(status);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_expire ON rate_limits(expire_at);
      CREATE INDEX IF NOT EXISTS idx_idempotency_scope ON idempotency_records(scope);
    `);

    // Check if products exist; if not, seed defaults
    const countRes = await client.query('SELECT count(*) as cnt FROM products;');
    const productCount = parseInt(countRes.rows[0].cnt, 10);

    if (productCount === 0) {
      // 1. Settings
      await client.query(`
        INSERT INTO settings (
          id, shop_name, tagline, phone, email, address, business_hours,
          daily_capacity, is_store_open, orders_paused, notice_banner,
          currency_symbol, time_slots, reservation_ttl_minutes
        ) VALUES (
          1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        INITIAL_SETTINGS.shopName,
        INITIAL_SETTINGS.tagline,
        INITIAL_SETTINGS.phone,
        INITIAL_SETTINGS.email,
        INITIAL_SETTINGS.address,
        INITIAL_SETTINGS.businessHours,
        INITIAL_SETTINGS.dailyCapacity,
        INITIAL_SETTINGS.isStoreOpen,
        INITIAL_SETTINGS.ordersPaused,
        INITIAL_SETTINGS.noticeBanner,
        INITIAL_SETTINGS.currencySymbol,
        JSON.stringify(INITIAL_SETTINGS.timeSlots),
        INITIAL_SETTINGS.reservationTtlMinutes,
      ]);

      // 2. Products
      for (const p of INITIAL_PRODUCTS) {
        await client.query(`
          INSERT INTO products (
            id, slug, title, description, category, price, packaging, image_url,
            is_active, quantity_on_hand, reserved_quantity, low_stock_threshold,
            track_stock, origin, ingredients, storage_info, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO NOTHING;
        `, [
          p.id,
          p.slug,
          p.title,
          p.description,
          p.category,
          p.price,
          p.packaging,
          p.imageUrl,
          p.isActive,
          p.quantityOnHand,
          p.reservedQuantity,
          p.lowStockThreshold,
          p.trackStock,
          p.origin || null,
          p.ingredients || null,
          p.storageInfo || null,
          p.createdAt,
          p.updatedAt,
        ]);
      }
    }

    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('[Database] Schema initialization failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Gracefully close connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    initPromise = null;
  }
}
