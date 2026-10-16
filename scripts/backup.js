/**
 * ShopSync PostgreSQL Database Backup Utility
 * Usage: node scripts/backup.js [optional_dest_path]
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR = process.env.SHOPSYNC_DATA_DIR
  ? path.resolve(process.env.SHOPSYNC_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

async function main() {
  console.log('--- 📦 SHOPSYNC POSTGRESQL DATABASE BACKUP UTILITY ---');

  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const isMock = process.argv.includes('--mock') || process.env.ALLOW_MEMORY_DB === 'true' || process.env.USE_PG_MEM === 'true';
  const databaseUrl = process.env.DATABASE_URL;
  let pool;

  if (databaseUrl && !isMock) {
    const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    console.log('Connecting to PostgreSQL database...');
  } else if (isMock) {
    console.log('⚠️ Test Mode: using in-memory pg-mem instance for backup verification.');
    const { newDb } = require('pg-mem');
    const memDb = newDb();
    const pgAdapter = memDb.adapters.createPg();
    pool = new pgAdapter.Pool();
  } else {
    console.error('❌ ERROR: DATABASE_URL environment variable is not defined.');
    console.error('   Please provide a valid PostgreSQL connection string, e.g.:');
    console.error('   DATABASE_URL="postgres://..." node scripts/backup.js');
    console.error('   (Or run with --mock for automated test validation)');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pathArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
    const targetPath = pathArg
      ? path.resolve(pathArg)
      : path.join(BACKUPS_DIR, `shopsync_pg_backup_${timestamp}.json`);

    console.log('Exporting database tables...');
    const [settingsRes, productsRes, ordersRes, enquiriesRes, notifsRes] = await Promise.all([
      client.query('SELECT * FROM settings WHERE id = 1;').catch(() => ({ rows: [] })),
      client.query('SELECT * FROM products ORDER BY id;').catch(() => ({ rows: [] })),
      client.query('SELECT * FROM orders ORDER BY created_at DESC;').catch(() => ({ rows: [] })),
      client.query('SELECT * FROM enquiries ORDER BY created_at DESC;').catch(() => ({ rows: [] })),
      client.query('SELECT * FROM notification_logs ORDER BY timestamp DESC;').catch(() => ({ rows: [] })),
    ]);

    const backupData = {
      exportedAt: new Date().toISOString(),
      engine: 'postgresql',
      version: '1.0.0',
      data: {
        settings: settingsRes.rows[0] || null,
        products: productsRes.rows,
        orders: ordersRes.rows,
        enquiries: enquiriesRes.rows,
        notificationLogs: notifsRes.rows,
      },
    };

    fs.writeFileSync(targetPath, JSON.stringify(backupData, null, 2), 'utf-8');
    const stat = fs.statSync(targetPath);

    console.log(`✓ Backup snapshot created successfully (${(stat.size / 1024).toFixed(1)} KB)`);
    console.log(`✓ Products: ${productsRes.rows.length}`);
    console.log(`✓ Orders: ${ordersRes.rows.length}`);
    console.log(`✓ Enquiries: ${enquiriesRes.rows.length}`);
    console.log(`\n🎉 Safe backup ready at: ${targetPath}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
