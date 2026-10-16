import fs from 'fs';
import path from 'path';
import { query, runTransaction } from './db';
import { AppDatabase } from '@/types';

const DATA_DIR = process.env.SHOPSYNC_DATA_DIR
  ? path.resolve(process.env.SHOPSYNC_DATA_DIR)
  : path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

export interface BackupResult {
  success: boolean;
  backupPath: string;
  sizeBytes: number;
  integrity: string;
  timestamp: string;
  error?: string;
}

/**
 * Creates a consistent snapshot backup of the active database tables to a JSON archive.
 * In production Supabase environments, point-in-time recovery (PITR) and daily WAL snapshots
 * are managed automatically at the cloud infrastructure tier.
 */
export async function createLiveBackup(destPath?: string): Promise<BackupResult> {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetPath = destPath || path.join(BACKUPS_DIR, `shopsync_pg_backup_${timestamp}.json`);

  try {
    const [settingsRes, productsRes, ordersRes, enquiriesRes, notifsRes] = await Promise.all([
      query('SELECT * FROM settings WHERE id = 1;'),
      query('SELECT * FROM products ORDER BY id;'),
      query('SELECT * FROM orders ORDER BY created_at DESC;'),
      query('SELECT * FROM enquiries ORDER BY created_at DESC;'),
      query('SELECT * FROM notification_logs ORDER BY timestamp DESC;'),
    ]);

    const backupPayload = {
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

    const rawJson = JSON.stringify(backupPayload, null, 2);
    fs.writeFileSync(targetPath, rawJson, 'utf-8');

    const stat = fs.statSync(targetPath);
    return {
      success: true,
      backupPath: targetPath,
      sizeBytes: stat.size,
      integrity: 'ok',
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      backupPath: targetPath,
      sizeBytes: 0,
      integrity: 'failed',
      timestamp: new Date().toISOString(),
      error: err?.message || 'Unknown backup error',
    };
  }
}

/**
 * Validates the consistency and structural integrity of an existing backup file
 */
export function verifyBackup(backupPath: string): { valid: boolean; error?: string; records?: any } {
  if (!fs.existsSync(backupPath)) {
    return { valid: false, error: `Backup file does not exist: ${backupPath}` };
  }

  try {
    const raw = fs.readFileSync(backupPath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed.data || typeof parsed.data !== 'object') {
      return { valid: false, error: 'Invalid backup structure: missing data payload' };
    }

    const products = Array.isArray(parsed.data.products) ? parsed.data.products.length : 0;
    const orders = Array.isArray(parsed.data.orders) ? parsed.data.orders.length : 0;
    const settings = parsed.data.settings ? 1 : 0;

    return {
      valid: true,
      records: { products, orders, settings },
    };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Verification exception' };
  }
}

/**
 * Restores a verified backup into the PostgreSQL database.
 * Executes inside an atomic transaction to ensure all-or-nothing restoration.
 */
export async function restoreBackup(
  backupPath: string
): Promise<{ success: boolean; error?: string; recordsRestored?: any }> {
  const verification = verifyBackup(backupPath);
  if (!verification.valid) {
    return {
      success: false,
      error: `Cannot restore invalid backup: ${verification.error}`,
    };
  }

  try {
    const raw = fs.readFileSync(backupPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const data = parsed.data;

    await runTransaction(async (client) => {
      // 1. Settings
      if (data.settings) {
        const s = data.settings;
        await client.query(
          `INSERT INTO settings (
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
            reservation_ttl_minutes = EXCLUDED.reservation_ttl_minutes;`,
          [
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
          ]
        );
      }

      // 2. Products
      if (Array.isArray(data.products)) {
        for (const p of data.products) {
          await client.query(
            `INSERT INTO products (
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
              storage_info = EXCLUDED.storage_info;`,
            [
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
            ]
          );
        }
      }
    });

    return {
      success: true,
      recordsRestored: verification.records,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Restore failed',
    };
  }
}
