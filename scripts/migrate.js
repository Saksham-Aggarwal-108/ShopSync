/**
 * ShopSync PostgreSQL Database Migration Runner
 * Applies schema.sql to the configured PostgreSQL database (Supabase or local).
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  const isDryRun = process.argv.includes('--dry-run') || process.env.USE_PG_MEM === 'true';
  const databaseUrl = process.env.DATABASE_URL;

  // Safety guard against tests targeting a production database
  if (process.env.NODE_ENV === 'test' && databaseUrl && !databaseUrl.includes('test') && !databaseUrl.includes('localhost') && !process.argv.includes('--allow-live-test')) {
    console.error('❌ SAFETY GUARD ENFORCED: NODE_ENV is set to "test", but DATABASE_URL points to a live/remote database.');
    console.error('   To prevent accidental schema alterations on production databases during testing, migration is aborted.');
    console.error('   Please provide TEST_DATABASE_URL or run in isolated dry-run mode (--dry-run).');
    process.exit(1);
  }

  let pool;
  if (isDryRun && !databaseUrl) {
    console.log('🔄 Running migration in isolated dry-run mode (using in-memory pg-mem engine)...');
    const { newDb } = require('pg-mem');
    const memDb = newDb();
    const adapter = memDb.adapters.createPg();
    pool = new adapter.Pool();
  } else if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not defined.');
    console.error('   Please provide a valid PostgreSQL connection string, e.g.:');
    console.error('   DATABASE_URL="postgres://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" node scripts/migrate.js');
    console.error('   (Or run with --dry-run to validate scripts/schema.sql offline)');
    process.exit(1);
  } else {
    console.log('🔄 Connecting to PostgreSQL database...');
    // Configure SSL for cloud databases (Supabase, Render, Neon, etc.)
    const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
  }

  const client = await pool.connect();

  try {
    console.log('📦 Reading scripts/schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

    console.log('🚀 Applying schema migrations...');
    await client.query('BEGIN;');

    await client.query(schemaSql);

    // Record migration version
    const migrationVersion = '20261016_phase6_postgresql_init';
    await client.query(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (version) DO NOTHING;
    `, [migrationVersion, 'Initial Phase 6 PostgreSQL schema for ShopSync (Vercel + Render + Supabase)']);

    // Check if initial seeding is needed
    const countRes = await client.query('SELECT count(*) as cnt FROM products;');
    const productCount = parseInt(countRes.rows[0].cnt, 10);

    if (productCount === 0) {
      console.log('🌱 Seeding default settings and initial artisan products...');

      // Initial settings
      await client.query(`
        INSERT INTO settings (
          id, shop_name, tagline, phone, email, address, business_hours,
          daily_capacity, is_store_open, orders_paused, notice_banner,
          currency_symbol, time_slots, reservation_ttl_minutes
        ) VALUES (
          1,
          'Greenwood Provisions',
          'Your Neighbourhood Organic Pantry & Bakery',
          '+1 (555) 382-9401',
          'hello@greenwoodprovisions.local',
          '14 Elmwood Terrace, Old Town Quarter',
          'Mon - Sat: 8:00 AM – 7:00 PM | Sun: 9:00 AM – 4:00 PM',
          12,
          TRUE,
          FALSE,
          '🌿 Harvest Special: Farm fresh organic milk & sourdough loaves delivered daily. Order ahead for convenient same-day pickup!',
          '£',
          $1,
          120
        ) ON CONFLICT (id) DO NOTHING;
      `, [JSON.stringify([
        'Morning: 09:00 AM - 12:00 PM',
        'Early Afternoon: 12:00 PM - 03:00 PM',
        'Late Afternoon: 03:00 PM - 06:00 PM',
      ])]);

      // Initial products
      const products = [
        [
          'prod-milk-01', 'farm-fresh-organic-whole-milk', 'Farm Fresh Organic Whole Milk',
          'Unhomogenised pasture-raised whole milk from Oakwood Jersey herd. Thick cream top, rich flavor, bottled daily in returnable glass.',
          'Dairy & Eggs', 2.80, '1 Litre Glass Bottle', '/images/products/milk.jpg', true, 8, 1, 3, true,
          'Oakwood Valley Organic Farm, Somerset', '100% Raw unhomogenised whole cows milk (Pasteurised)',
          'Keep refrigerated below 4°C. Consume within 4 days of delivery.'
        ],
        [
          'prod-bread-02', 'artisanal-country-sourdough', 'Artisanal Country Sourdough Loaf',
          'Stone-milled organic flour, 36-hour slow fermentation, blistered mahogany crust with an airy, pillowy crumb.',
          'Bakery', 4.50, '800g Wrapped Loaf', '/images/products/bread.jpg', true, 6, 0, 2, true,
          'The Flour & Stone In-house Bakery', 'Organic stoneground white & rye flour, natural levain culture, sea salt, water',
          'Keep wrapped in bread linen. Excellent for toasting up to day 5.'
        ],
        [
          'prod-honey-03', 'raw-wildflower-pure-honey', 'Raw Wildflower Pure Honey with Comb',
          'Cold-extracted unpasteurised honey infused with natural floral notes from local clover and heather meadows. Includes fresh honeycomb slice.',
          'Pantry', 7.20, '500g Hex Glass Pot', '/images/products/honey.jpg', true, 12, 2, 4, true,
          'Wessex Heathlands Apiary', '100% Pure raw wildflower honey, fresh comb piece',
          'Store at room temperature. Natural crystallization indicates raw purity.'
        ],
        [
          'prod-olive-04', 'cold-pressed-extra-virgin-olive-oil', 'Cold-Pressed Extra Virgin Olive Oil',
          'Single-estate early harvest Sicilian olives, cold-extracted within 6 hours of picking. Herbaceous, peppery finish.',
          'Pantry', 11.50, '750ml Dark UV Glass Bottle', '/images/products/olive_oil.jpg', true, 3, 1, 3, true,
          "L'Oliveto del Sole, Western Sicily", '100% Cold-pressed Nocellara del Belice & Biancolilla extra virgin olive oil',
          'Store in a cool dark place away from direct sunlight.'
        ],
        [
          'prod-truffles-05', 'belgian-dark-chocolate-truffles', 'Handcrafted Dark Chocolate Sea Salt Truffles',
          '72% Single-origin Ecuadorian dark chocolate ganache, dusted with raw Dutch cocoa and Maldon sea salt flakes.',
          'Confectionery', 8.90, 'Gift Box of 12 Truffles', '/images/products/truffles.jpg', true, 9, 0, 3, true,
          'The Cocoa Atelier, Bath', 'Ecuadorian cocoa mass, cocoa butter, organic cream, cane sugar, sea salt',
          'Best kept between 14°C and 18°C. Do not freeze.'
        ],
        [
          'prod-tomatoes-06', 'heirloom-heritage-organic-tomatoes', 'Heirloom Heritage Organic Tomatoes',
          'Sun-ripened mix of Black Krim, Brandywine, and Green Zebra varieties. Intensely sweet, vine-ripened on family farm.',
          'Produce', 3.90, '1kg Craft Punnet with Vine', '/images/products/tomatoes.jpg', true, 5, 0, 2, true,
          'Cotswold Heritage Organic Walled Garden', 'Freshly harvested heirloom tomatoes',
          'Store at room temperature with stems attached to maintain full sweetness.'
        ],
      ];

      for (const p of products) {
        await client.query(`
          INSERT INTO products (
            id, slug, title, description, category, price, packaging, image_url,
            is_active, quantity_on_hand, reserved_quantity, low_stock_threshold,
            track_stock, origin, ingredients, storage_info
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING;
        `, p);
      }
    }

    await client.query('COMMIT;');
    console.log('✅ PostgreSQL schema and baseline data migrated successfully.');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
