import crypto from 'crypto';
import { query, runTransaction } from './db';
import { queueNotificationOutbox } from './notifications';
import {
  AppDatabase,
  Product,
  Order,
  Enquiry,
  ShopSettings,
  NotificationLog,
  OrderStatus,
  EnquiryStatus,
  FulfilmentType,
} from '@/types';

function parseJson<T>(value: any, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toIso(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function toBool(val: any): boolean {
  return val === true || val === 1 || val === '1' || val === 'true';
}

function toNum(val: any, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

/**
 * Lazy / Automated Sweeper for Expired Reservations
 * Auto-cancels pending orders whose reservation TTL has expired and releases reserved stock.
 */
export async function sweepExpiredReservations(): Promise<number> {
  return runTransaction(async (client) => {
    const nowIso = new Date().toISOString();
    const expiredRes = await client.query(
      `SELECT * FROM orders
       WHERE (status = 'Pending' OR status = 'PENDING_REVIEW')
         AND reservation_expires_at <= $1
       FOR UPDATE;`,
      [nowIso]
    );

    const expiredOrders = expiredRes.rows;
    if (expiredOrders.length === 0) {
      return 0;
    }

    for (const ord of expiredOrders) {
      const items: Order['items'] = parseJson<Order['items']>(ord.items_json, []);

      for (const item of items) {
        await client.query(
          `UPDATE products
           SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
               updated_at = $2
           WHERE id = $3;`,
          [item.quantity, nowIso, item.productId]
        );
      }

      await client.query(
        `UPDATE orders
         SET status = 'Cancelled',
             cancellation_reason = 'Reservation expired (not confirmed within reservation window)',
             updated_at = $1
         WHERE id = $2;`,
        [nowIso, ord.id]
      );

      // Queue outbox notification
      try {
        await queueNotificationOutbox(
          'ORDER',
          ord.id,
          ord.customer_email,
          `Order ${ord.order_number} Expired — Greenwood Provisions`,
          `Hi ${ord.customer_name}, your order reservation of ${typeof ord.items_json === 'string' ? ord.items_json : JSON.stringify(ord.items_json)} has expired and released back to stock because it was not confirmed within the reservation window.`
        );
      } catch {
        // Outbox safety
      }
    }

    return expiredOrders.length;
  });
}

/**
 * Fetch all store data (Settings, Products, Orders, Enquiries, Logs)
 */
export async function getStoreData(): Promise<AppDatabase> {
  // Always sweep expired reservations first
  await sweepExpiredReservations();

  // Settings
  const sRes = await query('SELECT * FROM settings WHERE id = 1;');
  const sRow = sRes.rows[0] || {};
  const settings: ShopSettings = {
    shopName: sRow.shop_name || 'Greenwood Provisions',
    tagline: sRow.tagline || '',
    phone: sRow.phone || '',
    email: sRow.email || '',
    address: sRow.address || '',
    businessHours: sRow.business_hours || '',
    dailyCapacity: toNum(sRow.daily_capacity, 12),
    isStoreOpen: toBool(sRow.is_store_open),
    ordersPaused: toBool(sRow.orders_paused),
    noticeBanner: sRow.notice_banner || '',
    currencySymbol: sRow.currency_symbol || '£',
    timeSlots: parseJson<string[]>(sRow.time_slots, []),
    reservationTtlMinutes: toNum(sRow.reservation_ttl_minutes, 120),
  };

  // Products
  const pRes = await query('SELECT * FROM products ORDER BY title ASC;');
  const products: Product[] = pRes.rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    category: p.category,
    price: toNum(p.price),
    packaging: p.packaging,
    imageUrl: p.image_url,
    isActive: toBool(p.is_active),
    quantityOnHand: toNum(p.quantity_on_hand),
    reservedQuantity: toNum(p.reserved_quantity),
    lowStockThreshold: toNum(p.low_stock_threshold, 2),
    trackStock: toBool(p.track_stock),
    lastVerifiedAt: toIso(p.last_verified_at),
    origin: p.origin || undefined,
    ingredients: p.ingredients || undefined,
    storageInfo: p.storage_info || undefined,
    createdAt: toIso(p.created_at),
    updatedAt: toIso(p.updated_at),
  }));

  // Orders
  const oRes = await query('SELECT * FROM orders ORDER BY created_at DESC;');
  const orders: Order[] = oRes.rows.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    trackingToken: o.tracking_token,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    customerPhone: o.customer_phone,
    fulfilmentType: o.fulfilment_type as FulfilmentType,
    deliveryAddress: o.delivery_address || undefined,
    scheduledDate: o.scheduled_date,
    scheduledSlot: o.scheduled_slot,
    status: o.status as OrderStatus,
    items: parseJson<Order['items']>(o.items_json, []),
    totalAmount: toNum(o.total_amount),
    customerNotes: o.customer_notes || undefined,
    adminNotes: o.admin_notes || undefined,
    cancellationReason: o.cancellation_reason || undefined,
    reservationExpiresAt: toIso(o.reservation_expires_at),
    createdAt: toIso(o.created_at),
    updatedAt: toIso(o.updated_at),
  }));

  // Enquiries
  const eRes = await query('SELECT * FROM enquiries ORDER BY created_at DESC;');
  const enquiries: Enquiry[] = eRes.rows.map((e) => ({
    id: e.id,
    enquiryNumber: e.enquiry_number,
    customerName: e.customer_name,
    customerEmail: e.customer_email,
    customerPhone: e.customer_phone,
    productId: e.product_id || undefined,
    productTitle: e.product_title || undefined,
    message: e.message,
    status: e.status as EnquiryStatus,
    adminNotes: e.admin_notes || undefined,
    createdAt: toIso(e.created_at),
    updatedAt: toIso(e.updated_at),
  }));

  // Notification Logs
  const nRes = await query('SELECT * FROM notification_logs ORDER BY timestamp DESC LIMIT 100;');
  const notificationLogs: NotificationLog[] = nRes.rows.map((n) => ({
    id: n.id,
    entityType: n.entity_type,
    entityId: n.entity_id,
    recipient: n.recipient,
    subject: n.subject,
    body: n.body || undefined,
    channel: n.channel,
    status: n.status,
    attempts: toNum(n.attempts, 1),
    errorMessage: n.error_message || undefined,
    idempotencyKey: n.idempotency_key || undefined,
    timestamp: toIso(n.timestamp),
  }));

  return {
    settings,
    products,
    orders,
    enquiries,
    notificationLogs,
  };
}

export async function getSettings(): Promise<ShopSettings> {
  const sRes = await query('SELECT * FROM settings WHERE id = 1;');
  const sRow = sRes.rows[0] || {};
  return {
    shopName: sRow.shop_name || 'Greenwood Provisions',
    tagline: sRow.tagline || '',
    phone: sRow.phone || '',
    email: sRow.email || '',
    address: sRow.address || '',
    businessHours: sRow.business_hours || '',
    dailyCapacity: toNum(sRow.daily_capacity, 12),
    isStoreOpen: toBool(sRow.is_store_open),
    ordersPaused: toBool(sRow.orders_paused),
    noticeBanner: sRow.notice_banner || '',
    currencySymbol: sRow.currency_symbol || '£',
    timeSlots: parseJson<string[]>(sRow.time_slots, []),
    reservationTtlMinutes: toNum(sRow.reservation_ttl_minutes, 120),
  };
}

export async function updateSettings(newSettings: Partial<ShopSettings>): Promise<ShopSettings> {
  return runTransaction(async (client) => {
    const curRes = await client.query('SELECT * FROM settings WHERE id = 1 FOR UPDATE;');
    const current = curRes.rows[0] || {};

    const updated = {
      shop_name: newSettings.shopName !== undefined ? newSettings.shopName : current.shop_name,
      tagline: newSettings.tagline !== undefined ? newSettings.tagline : current.tagline,
      phone: newSettings.phone !== undefined ? newSettings.phone : current.phone,
      email: newSettings.email !== undefined ? newSettings.email : current.email,
      address: newSettings.address !== undefined ? newSettings.address : current.address,
      business_hours:
        newSettings.businessHours !== undefined ? newSettings.businessHours : current.business_hours,
      daily_capacity:
        newSettings.dailyCapacity !== undefined
          ? Math.max(0, Number(newSettings.dailyCapacity))
          : toNum(current.daily_capacity, 12),
      is_store_open:
        newSettings.isStoreOpen !== undefined ? Boolean(newSettings.isStoreOpen) : toBool(current.is_store_open),
      orders_paused:
        newSettings.ordersPaused !== undefined ? Boolean(newSettings.ordersPaused) : toBool(current.orders_paused),
      notice_banner:
        newSettings.noticeBanner !== undefined ? newSettings.noticeBanner : current.notice_banner,
      currency_symbol:
        newSettings.currencySymbol !== undefined ? newSettings.currencySymbol : current.currency_symbol,
      time_slots:
        newSettings.timeSlots !== undefined
          ? JSON.stringify(newSettings.timeSlots)
          : typeof current.time_slots === 'string'
          ? current.time_slots
          : JSON.stringify(current.time_slots || []),
      reservation_ttl_minutes:
        newSettings.reservationTtlMinutes !== undefined
          ? Number(newSettings.reservationTtlMinutes)
          : toNum(current.reservation_ttl_minutes, 120),
    };

    await client.query(
      `UPDATE settings
       SET shop_name = $1, tagline = $2, phone = $3, email = $4, address = $5,
           business_hours = $6, daily_capacity = $7, is_store_open = $8, orders_paused = $9,
           notice_banner = $10, currency_symbol = $11, time_slots = $12, reservation_ttl_minutes = $13
       WHERE id = 1;`,
      [
        updated.shop_name,
        updated.tagline,
        updated.phone,
        updated.email,
        updated.address,
        updated.business_hours,
        updated.daily_capacity,
        updated.is_store_open,
        updated.orders_paused,
        updated.notice_banner,
        updated.currency_symbol,
        updated.time_slots,
        updated.reservation_ttl_minutes,
      ]
    );

    return {
      shopName: updated.shop_name,
      tagline: updated.tagline,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
      businessHours: updated.business_hours,
      dailyCapacity: updated.daily_capacity,
      isStoreOpen: updated.is_store_open,
      ordersPaused: updated.orders_paused,
      noticeBanner: updated.notice_banner,
      currencySymbol: updated.currency_symbol,
      timeSlots: parseJson<string[]>(updated.time_slots, []),
      reservationTtlMinutes: updated.reservation_ttl_minutes,
    };
  });
}

export async function getProducts(activeOnly = false): Promise<Product[]> {
  const querySql = activeOnly
    ? 'SELECT * FROM products WHERE is_active = TRUE ORDER BY title ASC;'
    : 'SELECT * FROM products ORDER BY title ASC;';
  const res = await query(querySql);
  return res.rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    category: p.category,
    price: toNum(p.price),
    packaging: p.packaging,
    imageUrl: p.image_url,
    isActive: toBool(p.is_active),
    quantityOnHand: toNum(p.quantity_on_hand),
    reservedQuantity: toNum(p.reserved_quantity),
    lowStockThreshold: toNum(p.low_stock_threshold, 2),
    trackStock: toBool(p.track_stock),
    lastVerifiedAt: toIso(p.last_verified_at),
    origin: p.origin || undefined,
    ingredients: p.ingredients || undefined,
    storageInfo: p.storage_info || undefined,
    createdAt: toIso(p.created_at),
    updatedAt: toIso(p.updated_at),
  }));
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const res = await query('SELECT * FROM products WHERE slug = $1 OR id = $2 LIMIT 1;', [slug, slug]);
  const p = res.rows[0];
  if (!p) return undefined;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    category: p.category,
    price: toNum(p.price),
    packaging: p.packaging,
    imageUrl: p.image_url,
    isActive: toBool(p.is_active),
    quantityOnHand: toNum(p.quantity_on_hand),
    reservedQuantity: toNum(p.reserved_quantity),
    lowStockThreshold: toNum(p.low_stock_threshold, 2),
    trackStock: toBool(p.track_stock),
    lastVerifiedAt: toIso(p.last_verified_at),
    origin: p.origin || undefined,
    ingredients: p.ingredients || undefined,
    storageInfo: p.storage_info || undefined,
    createdAt: toIso(p.created_at),
    updatedAt: toIso(p.updated_at),
  };
}

export async function updateProductStock(
  productId: string,
  action: 'increment' | 'decrement' | 'set' | 'toggle_out_of_stock',
  amount?: number
): Promise<Product> {
  return runTransaction(async (client) => {
    const selRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE;', [productId]);
    const product = selRes.rows[0];
    if (!product) {
      throw new Error(`Product with ID ${productId} not found.`);
    }

    const currentOnHand = toNum(product.quantity_on_hand);
    let newOnHand = currentOnHand;
    if (action === 'toggle_out_of_stock') {
      newOnHand = currentOnHand > 0 ? 0 : 10;
    } else if (action === 'set' && typeof amount === 'number') {
      if (amount < 0) throw new Error('Stock quantity cannot be negative.');
      newOnHand = amount;
    } else if (action === 'increment' && typeof amount === 'number') {
      if (amount < 0) throw new Error('Increment amount cannot be negative.');
      newOnHand = currentOnHand + amount;
    } else if (action === 'decrement' && typeof amount === 'number') {
      if (amount < 0) throw new Error('Decrement amount cannot be negative.');
      newOnHand = Math.max(0, currentOnHand - amount);
    }

    const nowIso = new Date().toISOString();

    await client.query(
      `UPDATE products
       SET quantity_on_hand = $1, last_verified_at = $2, updated_at = $3
       WHERE id = $4;`,
      [newOnHand, nowIso, nowIso, productId]
    );

    const updRes = await client.query('SELECT * FROM products WHERE id = $1;', [productId]);
    const updated = updRes.rows[0];
    return {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      price: toNum(updated.price),
      packaging: updated.packaging,
      imageUrl: updated.image_url,
      isActive: toBool(updated.is_active),
      quantityOnHand: toNum(updated.quantity_on_hand),
      reservedQuantity: toNum(updated.reserved_quantity),
      lowStockThreshold: toNum(updated.low_stock_threshold, 2),
      trackStock: toBool(updated.track_stock),
      lastVerifiedAt: toIso(updated.last_verified_at),
      origin: updated.origin || undefined,
      ingredients: updated.ingredients || undefined,
      storageInfo: updated.storage_info || undefined,
      createdAt: toIso(updated.created_at),
      updatedAt: toIso(updated.updated_at),
    };
  });
}

export async function saveProduct(productData: Partial<Product>): Promise<Product> {
  return runTransaction(async (client) => {
    const nowIso = new Date().toISOString();

    if (productData.id) {
      const selRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE;', [productData.id]);
      const existing = selRes.rows[0];
      if (!existing) throw new Error('Product not found');

      await client.query(
        `UPDATE products
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             category = COALESCE($3, category),
             price = COALESCE($4, price),
             packaging = COALESCE($5, packaging),
             image_url = COALESCE($6, image_url),
             is_active = COALESCE($7, is_active),
             quantity_on_hand = COALESCE($8, quantity_on_hand),
             low_stock_threshold = COALESCE($9, low_stock_threshold),
             track_stock = COALESCE($10, track_stock),
             origin = COALESCE($11, origin),
             ingredients = COALESCE($12, ingredients),
             storage_info = COALESCE($13, storage_info),
             last_verified_at = $14,
             updated_at = $15
         WHERE id = $16;`,
        [
          productData.title || null,
          productData.description || null,
          productData.category || null,
          productData.price !== undefined ? Number(productData.price) : null,
          productData.packaging || null,
          productData.imageUrl || null,
          productData.isActive !== undefined ? Boolean(productData.isActive) : null,
          productData.quantityOnHand !== undefined ? Math.max(0, Number(productData.quantityOnHand)) : null,
          productData.lowStockThreshold !== undefined ? Math.max(0, Number(productData.lowStockThreshold)) : null,
          productData.trackStock !== undefined ? Boolean(productData.trackStock) : null,
          productData.origin || null,
          productData.ingredients || null,
          productData.storageInfo || null,
          nowIso,
          nowIso,
          productData.id,
        ]
      );

      const updRes = await client.query('SELECT * FROM products WHERE id = $1;', [productData.id]);
      const updated = updRes.rows[0];
      return {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        price: toNum(updated.price),
        packaging: updated.packaging,
        imageUrl: updated.image_url,
        isActive: toBool(updated.is_active),
        quantityOnHand: toNum(updated.quantity_on_hand),
        reservedQuantity: toNum(updated.reserved_quantity),
        lowStockThreshold: toNum(updated.low_stock_threshold, 2),
        trackStock: toBool(updated.track_stock),
        lastVerifiedAt: toIso(updated.last_verified_at),
        origin: updated.origin || undefined,
        ingredients: updated.ingredients || undefined,
        storageInfo: updated.storage_info || undefined,
        createdAt: toIso(updated.created_at),
        updatedAt: toIso(updated.updated_at),
      };
    } else {
      const id = `prod-${Date.now()}`;
      const slug = (productData.title || 'product')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      await client.query(
        `INSERT INTO products (
          id, slug, title, description, category, price, packaging, image_url,
          is_active, quantity_on_hand, reserved_quantity, low_stock_threshold,
          track_stock, last_verified_at, origin, ingredients, storage_info,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, $13, $14, $15, $16, $17, $18);`,
        [
          id,
          slug,
          productData.title || 'Untitled Product',
          productData.description || '',
          productData.category || 'General',
          Number(productData.price) || 0,
          productData.packaging || 'Standard Unit',
          productData.imageUrl || '/images/products/milk.jpg',
          productData.isActive !== false,
          Math.max(0, Number(productData.quantityOnHand) || 0),
          Math.max(0, Number(productData.lowStockThreshold) || 2),
          productData.trackStock !== false,
          nowIso,
          productData.origin || null,
          productData.ingredients || null,
          productData.storageInfo || null,
          nowIso,
          nowIso,
        ]
      );

      const insRes = await client.query('SELECT * FROM products WHERE id = $1;', [id]);
      const created = insRes.rows[0];
      return {
        id: created.id,
        slug: created.slug,
        title: created.title,
        description: created.description,
        category: created.category,
        price: toNum(created.price),
        packaging: created.packaging,
        imageUrl: created.image_url,
        isActive: toBool(created.is_active),
        quantityOnHand: toNum(created.quantity_on_hand),
        reservedQuantity: toNum(created.reserved_quantity),
        lowStockThreshold: toNum(created.low_stock_threshold, 2),
        trackStock: toBool(created.track_stock),
        lastVerifiedAt: toIso(created.last_verified_at),
        origin: created.origin || undefined,
        ingredients: created.ingredients || undefined,
        storageInfo: created.storage_info || undefined,
        createdAt: toIso(created.created_at),
        updatedAt: toIso(created.updated_at),
      };
    }
  });
}

export async function getDailyCapacityStatus(targetDate: string): Promise<{
  targetDate: string;
  dailyCapacity: number;
  activeOrdersCount: number;
  remainingCapacity: number;
  isFull: boolean;
  ordersPaused: boolean;
}> {
  await sweepExpiredReservations();

  const settings = await getSettings();

  const countRes = await query(
    `SELECT count(*) as cnt FROM orders
     WHERE scheduled_date = $1
       AND status IN ('Pending', 'Confirmed', 'Processing', 'Ready', 'PENDING_REVIEW', 'READY_FOR_PICKUP');`,
    [targetDate]
  );

  const activeOrdersCount = parseInt(countRes.rows[0]?.cnt || '0', 10);
  const dailyCapacity = settings.dailyCapacity;
  const remainingCapacity = Math.max(0, dailyCapacity - activeOrdersCount);
  const isFull = activeOrdersCount >= dailyCapacity;

  return {
    targetDate,
    dailyCapacity,
    activeOrdersCount,
    remainingCapacity,
    isFull,
    ordersPaused: settings.ordersPaused,
  };
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfilmentType: FulfilmentType;
  deliveryAddress?: string;
  scheduledDate: string;
  scheduledSlot: string;
  items: { productId: string; quantity: number }[];
  customerNotes?: string;
}

export async function createOrderAtomic(
  input: CreateOrderInput,
  idempotencyKey?: string
): Promise<{
  success: boolean;
  order?: Order;
  errorMessage?: string;
}> {
  return runTransaction(async (client) => {
    const nowIso = new Date().toISOString();

    // 0. Sweeper: reap any expired reservations right before checkout
    const expRes = await client.query(
      `SELECT * FROM orders
       WHERE (status = 'Pending' OR status = 'PENDING_REVIEW')
         AND reservation_expires_at <= $1
       FOR UPDATE;`,
      [nowIso]
    );

    for (const ord of expRes.rows) {
      const items: Order['items'] = parseJson<Order['items']>(ord.items_json, []);
      for (const item of items) {
        await client.query(
          `UPDATE products
           SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
               updated_at = $2
           WHERE id = $3;`,
          [item.quantity, nowIso, item.productId]
        );
      }
      await client.query(
        `UPDATE orders
         SET status = 'Cancelled',
             cancellation_reason = 'Reservation expired',
             updated_at = $1
         WHERE id = $2;`,
        [nowIso, ord.id]
      );
    }

    // 1. Idempotency Check
    if (idempotencyKey) {
      const idempRes = await client.query(
        'SELECT * FROM idempotency_records WHERE idempotency_key = $1 LIMIT 1;',
        [idempotencyKey]
      );

      if (idempRes.rows.length > 0) {
        try {
          const cachedOrder = parseJson<Order>(idempRes.rows[0].response_json, null as any);
          if (cachedOrder) {
            return {
              success: true,
              order: cachedOrder,
            };
          }
        } catch {
          // parse failed, proceed
        }
      }
    }

    // 2. Fetch Store Settings with FOR UPDATE to serialize daily capacity checking
    const sRes = await client.query('SELECT * FROM settings WHERE id = 1 FOR UPDATE;');
    const sRow = sRes.rows[0] || {};
    if (!toBool(sRow.is_store_open)) {
      return {
        success: false,
        errorMessage: 'The shop is currently closed. Please submit an enquiry instead.',
      };
    }

    if (toBool(sRow.orders_paused)) {
      return {
        success: false,
        errorMessage:
          'New order intake is temporarily paused today while we catch up on fulfilment. Product browsing and enquiries remain open!',
      };
    }

    // 3. Capacity Check for the scheduled date
    const capRes = await client.query(
      `SELECT count(*) as cnt FROM orders
       WHERE scheduled_date = $1
         AND status IN ('Pending', 'Confirmed', 'Processing', 'Ready', 'PENDING_REVIEW', 'READY_FOR_PICKUP');`,
      [input.scheduledDate]
    );

    const currentCapCount = parseInt(capRes.rows[0]?.cnt || '0', 10);
    const dailyCap = toNum(sRow.daily_capacity, 12);
    if (currentCapCount >= dailyCap) {
      return {
        success: false,
        errorMessage: `Daily fulfilment capacity (${dailyCap} orders) has been reached for ${input.scheduledDate}. Please select another date or send an enquiry.`,
      };
    }

    // 4. Concurrency-Safe Stock Check using ROW-LEVEL LOCKING (FOR UPDATE)
    const orderItems: Order['items'] = [];
    let calculatedTotal = 0;

    for (const requestedItem of input.items) {
      if (requestedItem.quantity <= 0) {
        return {
          success: false,
          errorMessage: 'Requested quantity must be at least 1.',
        };
      }

      // SELECT FOR UPDATE locks the product row against concurrent transactions
      const pRes = await client.query(
        'SELECT * FROM products WHERE id = $1 FOR UPDATE;',
        [requestedItem.productId]
      );
      const product = pRes.rows[0];

      if (!product || !toBool(product.is_active)) {
        return {
          success: false,
          errorMessage: `Product "${requestedItem.productId}" is not available.`,
        };
      }

      const qOnHand = toNum(product.quantity_on_hand);
      const qReserved = toNum(product.reserved_quantity);
      const availableStock = Math.max(0, qOnHand - qReserved);

      if (toBool(product.track_stock) && availableStock < requestedItem.quantity) {
        return {
          success: false,
          errorMessage: `Insufficient stock for "${product.title}". Requested: ${requestedItem.quantity}, Available: ${availableStock}. Please adjust quantity.`,
        };
      }

      const price = toNum(product.price);
      const lineSubtotal = Number((price * requestedItem.quantity).toFixed(2));
      calculatedTotal += lineSubtotal;

      orderItems.push({
        productId: product.id,
        productTitle: product.title,
        packaging: product.packaging,
        quantity: requestedItem.quantity,
        unitPrice: price,
        subtotal: lineSubtotal,
        imageUrl: product.image_url,
      });
    }

    // 5. Reserve Stock Atomically
    for (const item of orderItems) {
      await client.query(
        `UPDATE products
         SET reserved_quantity = reserved_quantity + $1,
             updated_at = $2
         WHERE id = $3;`,
        [item.quantity, nowIso, item.productId]
      );
    }

    // 6. Generate Order and Secure Tracking Token
    const totalOrdersRes = await client.query('SELECT count(*) as cnt FROM orders;');
    const orderNumber = `ORD-${1000 + parseInt(totalOrdersRes.rows[0]?.cnt || '0', 10) + 1}`;
    const trackingToken = `tr_${crypto.randomBytes(6).toString('hex')}`;
    const ttlMinutes = toNum(sRow.reservation_ttl_minutes, 120);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60000).toISOString();
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      trackingToken,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      fulfilmentType: input.fulfilmentType,
      deliveryAddress: input.deliveryAddress,
      scheduledDate: input.scheduledDate,
      scheduledSlot: input.scheduledSlot,
      status: 'Pending',
      items: orderItems,
      totalAmount: Number(calculatedTotal.toFixed(2)),
      customerNotes: input.customerNotes,
      reservationExpiresAt: expiresAt,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await client.query(
      `INSERT INTO orders (
        id, order_number, tracking_token, customer_name, customer_email,
        customer_phone, fulfilment_type, delivery_address, scheduled_date,
        scheduled_slot, status, items_json, total_amount, customer_notes,
        admin_notes, cancellation_reason, reservation_expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, NULL, $15, $16, $17);`,
      [
        newOrder.id,
        newOrder.orderNumber,
        newOrder.trackingToken,
        newOrder.customerName,
        newOrder.customerEmail,
        newOrder.customerPhone,
        newOrder.fulfilmentType,
        newOrder.deliveryAddress || null,
        newOrder.scheduledDate,
        newOrder.scheduledSlot,
        newOrder.status,
        JSON.stringify(newOrder.items),
        newOrder.totalAmount,
        newOrder.customerNotes || null,
        newOrder.reservationExpiresAt,
        newOrder.createdAt,
        newOrder.updatedAt,
      ]
    );

    // Save Idempotency Record
    if (idempotencyKey) {
      await client.query(
        `INSERT INTO idempotency_records (
          idempotency_key, scope, response_status, response_json, created_at
        ) VALUES ($1, 'checkout', 200, $2, $3)
        ON CONFLICT (idempotency_key) DO NOTHING;`,
        [idempotencyKey, JSON.stringify(newOrder), nowIso]
      );
    }

    // 7. Queue Outbox Notification
    try {
      await queueNotificationOutbox(
        'ORDER',
        newOrder.id,
        newOrder.customerEmail,
        `Order Received: ${newOrder.orderNumber} (Pending Review) — ${sRow.shop_name}`,
        `Hi ${newOrder.customerName}, your order has been received and is awaiting shopkeeper confirmation.`,
        `notif-order-created-${newOrder.id}`
      );
    } catch {
      // Outbox safety
    }

    return {
      success: true,
      order: newOrder,
    };
  });
}

/**
 * Valid Status Transitions Matrix
 */
const VALID_NEXT_STATUSES: Record<string, string[]> = {
  Pending: ['Confirmed', 'Cancelled', 'REJECTED', 'RESCHEDULED'],
  PENDING_REVIEW: ['Confirmed', 'Cancelled', 'REJECTED', 'RESCHEDULED', 'CONFIRMED'],
  Confirmed: ['Processing', 'Ready', 'Cancelled', 'REJECTED', 'RESCHEDULED'],
  CONFIRMED: ['Processing', 'Ready', 'Cancelled', 'REJECTED', 'RESCHEDULED'],
  Processing: ['Ready', 'Cancelled', 'Fulfilled'],
  Ready: ['Fulfilled', 'Cancelled'],
  READY_FOR_PICKUP: ['Fulfilled', 'COMPLETED', 'Cancelled'],
  Fulfilled: [], // Terminal
  COMPLETED: [], // Terminal
  Cancelled: [], // Terminal
  REJECTED: [], // Terminal
  RESCHEDULED: ['Pending', 'Confirmed', 'Processing', 'Ready', 'Cancelled'],
};

export async function updateOrderStatus(
  orderId: string,
  newStatus?: OrderStatus,
  options?: {
    adminNotes?: string;
    cancellationReason?: string;
    rescheduledDate?: string;
    rescheduledSlot?: string;
    reservationExpiresAt?: string;
  }
): Promise<Order> {
  return runTransaction(async (client) => {
    const selRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE;', [orderId]);
    const row = selRes.rows[0];
    if (!row) {
      throw new Error(`Order ${orderId} not found`);
    }

    const previousStatus = row.status as OrderStatus;
    const targetStatus = newStatus || previousStatus;
    const nowIso = new Date().toISOString();

    // 1. Enforce Valid Status Transitions
    const allowed = VALID_NEXT_STATUSES[previousStatus] || [];
    if (previousStatus !== targetStatus && !allowed.includes(targetStatus)) {
      throw new Error(
        `Invalid status transition from "${previousStatus}" to "${targetStatus}". Order is in terminal or non-permissible state.`
      );
    }

    // 2. Race Condition Check: Owner confirming an expired reservation
    if (
      (targetStatus === 'Confirmed' || targetStatus === 'CONFIRMED') &&
      (previousStatus === 'Pending' || previousStatus === 'PENDING_REVIEW')
    ) {
      const expiresAtIso = toIso(row.reservation_expires_at);
      if (expiresAtIso && expiresAtIso <= nowIso) {
        throw new Error(
          `Cannot confirm order ${row.order_number}: reservation expired at ${expiresAtIso}. Stock has been released.`
        );
      }
    }

    // 3. Rescheduling Capacity Check
    if (options?.rescheduledDate && options.rescheduledDate !== row.scheduled_date) {
      const sRes = await client.query('SELECT daily_capacity FROM settings WHERE id = 1;');
      const dailyCap = toNum(sRes.rows[0]?.daily_capacity, 12);

      const countRes = await client.query(
        `SELECT count(*) as cnt FROM orders
         WHERE scheduled_date = $1
           AND status IN ('Pending', 'Confirmed', 'Processing', 'Ready', 'PENDING_REVIEW', 'READY_FOR_PICKUP');`,
        [options.rescheduledDate]
      );
      const currentCount = parseInt(countRes.rows[0]?.cnt || '0', 10);

      if (currentCount >= dailyCap) {
        throw new Error(
          `Cannot reschedule to ${options.rescheduledDate}: daily fulfilment capacity (${dailyCap}) is full.`
        );
      }
    }

    const items: Order['items'] = parseJson<Order['items']>(row.items_json, []);

    // 4. Exact-Once Reservation Release on Cancellation or Rejection
    const isNowCancelled = targetStatus === 'Cancelled' || targetStatus === 'REJECTED';
    const wasAlreadyCancelled = previousStatus === 'Cancelled' || previousStatus === 'REJECTED';
    const wasAlreadyFulfilled = previousStatus === 'Fulfilled' || previousStatus === 'COMPLETED';

    if (isNowCancelled && !wasAlreadyCancelled && !wasAlreadyFulfilled) {
      for (const item of items) {
        await client.query(
          `UPDATE products
           SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
               updated_at = $2
           WHERE id = $3;`,
          [item.quantity, nowIso, item.productId]
        );
      }
    }

    // 5. Exact-Once Stock Deduction on Fulfilment
    const isNowFulfilled = targetStatus === 'Fulfilled' || targetStatus === 'COMPLETED';
    if (isNowFulfilled && !wasAlreadyFulfilled) {
      for (const item of items) {
        await client.query(
          `UPDATE products
           SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1),
               reserved_quantity = GREATEST(0, reserved_quantity - $2),
               updated_at = $3
           WHERE id = $4;`,
          [item.quantity, item.quantity, nowIso, item.productId]
        );
      }
    }

    // 6. Update order record
    const scheduledDate = options?.rescheduledDate || row.scheduled_date;
    const scheduledSlot = options?.rescheduledSlot || row.scheduled_slot;
    const adminNotes = options?.adminNotes !== undefined ? options.adminNotes : row.admin_notes;
    const cancellationReason =
      options?.cancellationReason !== undefined ? options.cancellationReason : row.cancellation_reason;
    const reservationExpiresAt = options?.reservationExpiresAt || row.reservation_expires_at;

    await client.query(
      `UPDATE orders
       SET status = $1, scheduled_date = $2, scheduled_slot = $3, admin_notes = $4,
           cancellation_reason = $5, reservation_expires_at = $6, updated_at = $7
       WHERE id = $8;`,
      [
        targetStatus,
        scheduledDate,
        scheduledSlot,
        adminNotes,
        cancellationReason,
        reservationExpiresAt,
        nowIso,
        orderId,
      ]
    );

    const sRes = await client.query('SELECT shop_name FROM settings WHERE id = 1;');
    const shopName = sRes.rows[0]?.shop_name || 'Greenwood Provisions';

    // 7. Queue Status Change Notification
    try {
      await queueNotificationOutbox(
        'ORDER',
        row.id,
        row.customer_email,
        `Order ${row.order_number} Status: ${targetStatus} — ${shopName}`,
        `Hi ${row.customer_name}, your order ${row.order_number} status has updated to: ${targetStatus}.`,
        `notif-order-status-${orderId}-${targetStatus}`
      );
    } catch {
      // Outbox safety
    }

    return {
      id: row.id,
      orderNumber: row.order_number,
      trackingToken: row.tracking_token,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      fulfilmentType: row.fulfilment_type as FulfilmentType,
      deliveryAddress: row.delivery_address || undefined,
      scheduledDate,
      scheduledSlot,
      status: targetStatus,
      items,
      totalAmount: toNum(row.total_amount),
      customerNotes: row.customer_notes || undefined,
      adminNotes: adminNotes || undefined,
      cancellationReason: cancellationReason || undefined,
      reservationExpiresAt: toIso(row.reservation_expires_at),
      createdAt: toIso(row.created_at),
      updatedAt: nowIso,
    };
  });
}

export async function submitEnquiryAtomic(input: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productId?: string;
  message: string;
}): Promise<Enquiry> {
  return runTransaction(async (client) => {
    let productTitle: string | undefined;
    if (input.productId) {
      const pRes = await client.query('SELECT title FROM products WHERE id = $1;', [input.productId]);
      if (pRes.rows[0]) productTitle = pRes.rows[0].title;
    }

    const totalEnqRes = await client.query('SELECT count(*) as cnt FROM enquiries;');
    const enquiryNumber = `ENQ-${500 + parseInt(totalEnqRes.rows[0]?.cnt || '0', 10) + 1}`;
    const id = `enq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    await client.query(
      `INSERT INTO enquiries (
        id, enquiry_number, customer_name, customer_email, customer_phone,
        product_id, product_title, message, status, admin_notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'New', NULL, $9, $10);`,
      [
        id,
        enquiryNumber,
        input.customerName,
        input.customerEmail,
        input.customerPhone,
        input.productId || null,
        productTitle || null,
        input.message,
        nowIso,
        nowIso,
      ]
    );

    const sRes = await client.query('SELECT shop_name FROM settings WHERE id = 1;');
    const shopName = sRes.rows[0]?.shop_name || 'Greenwood Provisions';

    try {
      await queueNotificationOutbox(
        'ENQUIRY',
        id,
        input.customerEmail,
        `Enquiry Received (${enquiryNumber}) — ${shopName}`,
        `Hi ${input.customerName}, thank you for contacting ${shopName}. We have received your enquiry regarding ${productTitle || 'our products'} and will respond within our regular business hours.`,
        `notif-enq-${id}`
      );
    } catch {
      // Outbox safety
    }

    return {
      id,
      enquiryNumber,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      productId: input.productId,
      productTitle,
      message: input.message,
      status: 'New',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  });
}

export async function updateEnquiryStatus(
  enquiryId: string,
  status: EnquiryStatus,
  adminNotes?: string
): Promise<Enquiry> {
  return runTransaction(async (client) => {
    const selRes = await client.query('SELECT * FROM enquiries WHERE id = $1 FOR UPDATE;', [enquiryId]);
    const row = selRes.rows[0];
    if (!row) {
      throw new Error(`Enquiry ${enquiryId} not found`);
    }

    const nowIso = new Date().toISOString();
    const finalNotes = adminNotes !== undefined ? adminNotes : row.admin_notes;

    await client.query(
      `UPDATE enquiries
       SET status = $1, admin_notes = $2, updated_at = $3
       WHERE id = $4;`,
      [status, finalNotes, nowIso, enquiryId]
    );

    return {
      id: row.id,
      enquiryNumber: row.enquiry_number,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      productId: row.product_id || undefined,
      productTitle: row.product_title || undefined,
      message: row.message,
      status,
      adminNotes: finalNotes || undefined,
      createdAt: toIso(row.created_at),
      updatedAt: nowIso,
    };
  });
}

/**
 * Order Tracking Lookup — STRICT TOKEN VALIDATION REQUIRED
 */
export async function getOrderByTracking(orderNumberOrId: string, token?: string): Promise<Order | null> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return null; // Token is strictly mandatory
  }

  const res = await query(
    `SELECT * FROM orders
     WHERE (id = $1 OR UPPER(order_number) = UPPER($2))
       AND tracking_token = $3
     LIMIT 1;`,
    [orderNumberOrId, orderNumberOrId, token.trim()]
  );

  const row = res.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    orderNumber: row.order_number,
    trackingToken: row.tracking_token,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    fulfilmentType: row.fulfilment_type as FulfilmentType,
    deliveryAddress: row.delivery_address || undefined,
    scheduledDate: row.scheduled_date,
    scheduledSlot: row.scheduled_slot,
    status: row.status as OrderStatus,
    items: parseJson<Order['items']>(row.items_json, []),
    totalAmount: toNum(row.total_amount),
    customerNotes: row.customer_notes || undefined,
    adminNotes: row.admin_notes || undefined,
    cancellationReason: row.cancellation_reason || undefined,
    reservationExpiresAt: toIso(row.reservation_expires_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

// Backward-compatible alias for existing callers
export async function queueNotification(
  entityType: 'ORDER' | 'ENQUIRY',
  entityId: string,
  recipient: string,
  subject: string,
  body: string
): Promise<NotificationLog> {
  return queueNotificationOutbox(entityType, entityId, recipient, subject, body);
}
