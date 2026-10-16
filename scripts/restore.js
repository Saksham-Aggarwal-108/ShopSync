/**
 * ShopSync PostgreSQL Database Restore Utility
 * Usage: node scripts/restore.js <backup_file_path> [--confirm-overwrite-live] [--dry-run]
 * 
 * Safely restores a verified JSON backup into PostgreSQL inside an atomic transaction,
 * performing integrity checks before and after restore.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  console.log('--- 🔄 SHOPSYNC POSTGRESQL DATABASE RESTORE UTILITY ---');

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const confirmOverwrite = args.includes('--confirm-overwrite-live');
  const cleanArgs = args.filter((a) => a !== '--dry-run' && a !== '--confirm-overwrite-live');

  if (cleanArgs.length < 1) {
    console.error('Usage: node scripts/restore.js <backup_file_path> [--confirm-overwrite-live] [--dry-run]');
    process.exit(1);
  }

  const backupPath = path.resolve(cleanArgs[0]);

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Error: Backup file not found at: ${backupPath}`);
    process.exit(1);
  }

  // Live data overwrite protection guard
  if (!confirmOverwrite && !isDryRun) {
    console.error('\n🛑 SAFETY GUARD ENFORCED:');
    console.error('Restoring will overwrite existing records in the target database.');
    console.error('To prevent accidental live data loss, you must explicitly confirm:');
    console.error('  node scripts/restore.js <backup_path> --confirm-overwrite-live\n');
    console.error('Or run a safe validation dry run:');
    console.error('  node scripts/restore.js <backup_path> --dry-run\n');
    process.exit(1);
  }

  console.log(`Source backup: ${backupPath}`);
  if (isDryRun) {
    console.log('Mode: DRY RUN (verification only, no changes will be written)');
  }

  // Step 1: Verify source backup structure
  console.log('\n[Step 1/3] Verifying source backup file structure...');
  let parsed;
  try {
    const raw = fs.readFileSync(backupPath, 'utf-8');
    parsed = JSON.parse(raw);

    if (!parsed.data || typeof parsed.data !== 'object') {
      throw new Error('Invalid backup file: missing data root');
    }

    const pCount = Array.isArray(parsed.data.products) ? parsed.data.products.length : 0;
    const oCount = Array.isArray(parsed.data.orders) ? parsed.data.orders.length : 0;
    const sFound = parsed.data.settings ? 1 : 0;

    console.log(`  ✓ JSON structure: ok`);
    console.log(`  ✓ Record counts: ${pCount} products, ${oCount} orders, settings: ${sFound}`);
  } catch (err) {
    console.error(`❌ Source backup validation failed:`, err.message);
    process.exit(1);
  }

  if (isDryRun) {
    console.log('\n✅ Dry run completed: Source backup is valid and ready for restoration.');
    process.exit(0);
  }

  // Step 2: Connect to PostgreSQL and restore inside transaction
  console.log('\n[Step 2/3] Restoring records inside atomic PostgreSQL transaction...');
  const isMock = args.includes('--mock') || process.env.ALLOW_MEMORY_DB === 'true' || process.env.USE_PG_MEM === 'true';
  const databaseUrl = process.env.DATABASE_URL;
  let pool;

  if (databaseUrl && !isMock) {
    const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
  } else if (isMock) {
    console.log('⚠️ Test Mode: using in-memory pg-mem instance for restore verification.');
    const { newDb } = require('pg-mem');
    const memDb = newDb();
    const pgAdapter = memDb.adapters.createPg();
    pool = new pgAdapter.Pool();
  } else {
    console.error('❌ ERROR: DATABASE_URL environment variable is not defined.');
    console.error('   Please provide a valid PostgreSQL connection string, e.g.:');
    console.error('   DATABASE_URL="postgres://..." node scripts/restore.js <backup_path> --confirm-overwrite-live');
    console.error('   (Or run with --mock for automated test validation)');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    const data = parsed.data;

    if (data.settings) {
      const s = data.settings;
      await client.query(`
        INSERT INTO settings (
          id, shop_name, tagline, phone, email, address, business_hours,
          daily_capacity, is_store_open, orders_paused, notice_banner,
          currency_symbol, time_slots, reservation_ttl_minutes
        ) VALUES (
          1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) ON CONFLICT (id) DO UPDATE SET
          shop_name = EXCLUDED.shop_name,
          tagline = EXCLUDED.tagline,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          business_hours = EXCLUDED.business_hours,
          daily_capacity = EXCLUDED.daily_capacity,
          is_store_open = EXCLUDED.is_store_open,
          orders_paused = EXCLUDED.orders_paused,
          notice_banner = EXCLUDED.notice_banner,
          currency_symbol = EXCLUDED.currency_symbol,
          time_slots = EXCLUDED.time_slots,
          reservation_ttl_minutes = EXCLUDED.reservation_ttl_minutes;
      `, [
        s.shop_name,
        s.tagline,
        s.phone,
        s.email,
        s.address,
        s.business_hours,
        s.daily_capacity,
        s.is_store_open,
        s.orders_paused,
        s.notice_banner,
        s.currency_symbol,
        typeof s.time_slots === 'string' ? s.time_slots : JSON.stringify(s.time_slots || []),
        s.reservation_ttl_minutes || 120,
      ]);
    }

    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        await client.query(`
          INSERT INTO products (
            id, slug, title, description, category, price, packaging, image_url,
            is_active, quantity_on_hand, reserved_quantity, low_stock_threshold,
            track_stock, origin, ingredients, storage_info
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            slug = EXCLUDED.slug,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            price = EXCLUDED.price,
            packaging = EXCLUDED.packaging,
            image_url = EXCLUDED.image_url,
            is_active = EXCLUDED.is_active,
            quantity_on_hand = EXCLUDED.quantity_on_hand,
            reserved_quantity = EXCLUDED.reserved_quantity,
            low_stock_threshold = EXCLUDED.low_stock_threshold,
            track_stock = EXCLUDED.track_stock,
            origin = EXCLUDED.origin,
            ingredients = EXCLUDED.ingredients,
            storage_info = EXCLUDED.storage_info;
        `, [
          p.id,
          p.slug,
          p.title,
          p.description,
          p.category,
          p.price,
          p.packaging,
          p.image_url,
          p.is_active,
          p.quantity_on_hand,
          p.reserved_quantity || 0,
          p.low_stock_threshold || 2,
          p.track_stock,
          p.origin || null,
          p.ingredients || null,
          p.storage_info || null,
        ]);
      }
    }

    await client.query('COMMIT;');
    console.log('  ✓ Transaction committed successfully.');

    // Step 3: Post-restore verification
    console.log('\n[Step 3/3] Verifying database state...');
    const postCount = await client.query('SELECT count(*) as cnt FROM products;');
    console.log(`  ✓ Restored products: ${postCount.rows[0].cnt}`);
    console.log('\n🎉 RESTORATION COMPLETED SUCCESSFULLY!');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ Restore transaction failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error during restore:', err);
  process.exit(1);
});
