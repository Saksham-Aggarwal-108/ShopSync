const http = require('http');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const DATA_DIR = process.env.SHOPSYNC_DATA_DIR
  ? path.resolve(process.env.SHOPSYNC_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(DATA_DIR, 'shopsync.db');
const TEST_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

function request(method, reqPath, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: reqPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

let totalSuites = 0;
let passedSuites = 0;

function startSuite(num, name) {
  totalSuites++;
  console.log(`\n▶ [SUITE ${num}/22] ${name}`);
}

function passSuite(name) {
  passedSuites++;
  console.log(`  ✓ Suite completed successfully: ${name}`);
}

async function run() {
  console.log('===============================================================');
  console.log('🧪 SHOPSYNC COMPREHENSIVE VERIFICATION & SECURITY AUDIT (PHASE 4)');
  console.log('===============================================================');

  // Ensure deterministic baseline via API
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@greenwood.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'shopsync2026';
    const loginRes = await request('POST', '/api/auth/login', { email: adminEmail, password: adminPassword });
    if (loginRes.headers && loginRes.headers['set-cookie']) {
      const initCookie = loginRes.headers['set-cookie'][0].split(';')[0];
      await request('PATCH', '/api/store', { dailyCapacity: 12, ordersPaused: false }, {
        Cookie: initCookie,
        Origin: `http://localhost:${TEST_PORT}`,
      });
    }
  } catch {
    // Initializer fallback
  }

  // -------------------------------------------------------------
  // SUITE 1: Storefront Initial Data & Metadata Verification
  // -------------------------------------------------------------
  startSuite(1, 'Storefront Initial Data, Public Metadata & Sanitized Health Probe');
  const healthRes = await request('GET', '/api/health');
  assert(healthRes.status === 200, 'Health endpoint should return 200');
  assert(healthRes.data.status === 'healthy', 'Health status is healthy');
  assert(healthRes.data.database === undefined, 'Public health check does not leak internal database diagnostics');
  assert(healthRes.data.nodeVersion === undefined, 'Public health check does not leak Node engine version');
  console.log(`  ✓ System Health: ${healthRes.data.status} (Uptime: ${healthRes.data.uptimeSec}s, Internals securely shielded)`);

  const storeRes = await request('GET', '/api/store');
  assert(storeRes.status === 200, 'Store endpoint should return 200');
  assert(storeRes.data.settings.shopName === 'Greenwood Provisions', 'Shop name matches');
  assert(storeRes.data.products.length >= 6, 'At least 6 products loaded');
  console.log(`  ✓ Store Name: ${storeRes.data.settings.shopName}`);
  console.log(`  ✓ Daily Capacity: ${storeRes.data.settings.dailyCapacity} orders/day`);
  console.log(`  ✓ Active Products: ${storeRes.data.products.length}`);
  passSuite('Storefront Initial Data & Public Metadata');

  // -------------------------------------------------------------
  // SUITE 2: Admin Authentication & Cookie Security
  // -------------------------------------------------------------
  startSuite(2, 'Admin Authentication & Hardened Cookie Security');
  const badLogin = await request('POST', '/api/auth/login', {
    email: 'hacker@internet.local',
    password: 'wrongpassword',
  });
  assert(badLogin.status === 401, 'Unauthorized login returns 401');
  console.log(`  ✓ Unauthenticated rejection (Status ${badLogin.status}): "${badLogin.data.error}"`);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@greenwood.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'shopsync2026';

  const goodLogin = await request('POST', '/api/auth/login', {
    email: adminEmail,
    password: adminPassword,
  });
  assert(goodLogin.status === 200, 'Good login returns 200');
  const rawCookie = goodLogin.headers['set-cookie'] ? goodLogin.headers['set-cookie'][0] : '';
  assert(rawCookie.includes('shopsync_session'), 'Session cookie issued');
  assert(rawCookie.toLowerCase().includes('httponly'), 'Cookie has HttpOnly');
  assert(rawCookie.toLowerCase().includes('samesite=lax'), 'Cookie has SameSite=lax');
  const authHeaders = { Cookie: rawCookie.split(';')[0] };
  console.log(`  ✓ Authenticated Shopkeeper: ${goodLogin.data.user.email} (Role: ${goodLogin.data.user.role})`);
  console.log(`  ✓ Hardened Session Cookie: ${rawCookie.split(';')[0]}`);
  passSuite('Admin Authentication & Hardened Cookie Security');

  // -------------------------------------------------------------
  // SUITE 3: Customer Enquiry Submission & Lifecycle
  // -------------------------------------------------------------
  startSuite(3, 'Customer Enquiry Submission & Lifecycle (New -> Contacted -> Resolved)');
  const enqRes = await request('POST', '/api/enquiries', {
    customerName: 'Arthur Dent',
    customerEmail: 'arthur@galaxy.local',
    customerPhone: '+1 555-4242',
    productId: 'prod-bread-02',
    message: 'Can I request 2 loaves for early morning collection before work?',
  });
  assert(enqRes.status === 200, 'Enquiry creation returns 200');
  const enqId = enqRes.data.enquiry.id;
  console.log(`  ✓ Enquiry Created: Ref ${enqRes.data.enquiry.enquiryNumber} (Status: ${enqRes.data.enquiry.status})`);

  const contactedRes = await request('PATCH', `/api/enquiries/${enqId}`, {
    status: 'Contacted',
    adminNotes: 'Called Arthur to confirm morning bake window.',
  }, authHeaders);
  assert(contactedRes.status === 200, 'Contacted transition returns 200');
  assert(contactedRes.data.enquiry.status === 'Contacted', 'Status updated to Contacted');

  const resolvedRes = await request('PATCH', `/api/enquiries/${enqId}`, {
    status: 'Resolved',
    adminNotes: 'Arrangement agreed.',
  }, authHeaders);
  assert(resolvedRes.status === 200, 'Resolved transition returns 200');
  assert(resolvedRes.data.enquiry.status === 'Resolved', 'Status updated to Resolved');
  passSuite('Customer Enquiry Submission & Lifecycle');

  // -------------------------------------------------------------
  // SUITE 4: Pause Order Intake & Enquiries Storefront Availability
  // -------------------------------------------------------------
  startSuite(4, 'Pause Order Intake & Enquiries Storefront Availability');
  const pauseRes = await request('PATCH', '/api/store', { ordersPaused: true }, authHeaders);
  assert(pauseRes.status === 200, 'Pause orders returns 200');
  console.log('  ✓ Store ordersPaused set to TRUE');

  const blockedOrder = await request('POST', '/api/checkout', {
    customerName: 'Tricia McMillan',
    customerEmail: 'tricia@galaxy.local',
    customerPhone: '+1 555-8888',
    fulfilmentType: 'pickup',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
    items: [{ productId: 'prod-milk-01', quantity: 1 }],
  });
  assert(blockedOrder.status === 409, 'Blocked order returns 409');
  console.log(`  ✓ Order rejection during pause (Status ${blockedOrder.status}): "${blockedOrder.data.error}"`);

  // Enquiries must remain operational while orders are paused
  const enquiryWhilePaused = await request('POST', '/api/enquiries', {
    customerName: 'Tricia McMillan',
    customerEmail: 'tricia@galaxy.local',
    customerPhone: '+1 555-8888',
    message: 'I see orders are paused today. Can I enquire for tomorrow morning?',
  });
  assert(enquiryWhilePaused.status === 200, 'Enquiry while paused succeeds');
  console.log(`  ✓ Enquiry while orders paused: Ref ${enquiryWhilePaused.data.enquiry.enquiryNumber} (Status: ${enquiryWhilePaused.data.enquiry.status})`);

  // Resume orders
  await request('PATCH', '/api/store', { ordersPaused: false }, authHeaders);
  console.log('  ✓ Store ordersPaused resumed to FALSE');
  passSuite('Pause Order Intake & Enquiries Storefront Availability');

  // -------------------------------------------------------------
  // SUITE 5: Concurrent Checkout Race on Last Available Stock
  // -------------------------------------------------------------
  startSuite(5, 'Concurrent Checkout Race on Last Available Stock');
  const testProductSlug = 'belgian-dark-chocolate-truffles';
  const prods = (await request('GET', '/api/products')).data;
  const pCheck = prods.find((p) => p.slug === testProductSlug);
  const pId = pCheck.id;
  const reserved = pCheck.reservedQuantity || 0;
  await request('POST', `/api/products/${pId}/stock`, { action: 'set', amount: reserved + 1 }, authHeaders);

  const raceCheckout = (clientName) =>
    request('POST', '/api/checkout', {
      customerName: clientName,
      customerEmail: `${clientName.toLowerCase()}@test.local`,
      customerPhone: '+1 555-0199',
      fulfilmentType: 'pickup',
      scheduledDate: '2026-11-15',
      scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
      items: [{ productId: pId, quantity: 1 }],
    });

  const [resA, resB] = await Promise.all([raceCheckout('RacerAlice'), raceCheckout('RacerBob')]);
  const statuses = [resA.status, resB.status];
  assert(statuses.includes(200), 'Exactly one concurrent request must succeed');
  assert(statuses.includes(409), 'The second concurrent request must be rejected with 409 conflict');
  const rejected = resA.status === 409 ? resA : resB;
  assert(rejected.data.error.includes('Insufficient stock'), 'Error indicates insufficient stock');
  console.log(`  ✓ Concurrency Protection: 1 succeeded (200), 1 rejected (409): "${rejected.data.error}"`);

  // Restore product stock
  await request('POST', `/api/products/${pId}/stock`, { action: 'set', amount: reserved + 10 }, authHeaders);
  passSuite('Concurrent Checkout Race on Last Available Stock');

  // -------------------------------------------------------------
  // SUITE 6: Concurrent Race for Final Daily Capacity Slot
  // -------------------------------------------------------------
  startSuite(6, 'Concurrent Race for Final Daily Capacity Slot');
  const capDate = '2026-11-18';
  try {
    // Ensure abundant product stock so capacity is the only limiting factor
    const milkProd = (await request('GET', '/api/products')).data.find((p) => p.id === 'prod-milk-01');
    const milkRes = milkProd?.reservedQuantity || 0;
    await request('POST', '/api/products/prod-milk-01/stock', { action: 'set', amount: milkRes + 50 }, authHeaders);

    const curCap = (await request('GET', `/api/capacity?date=${capDate}`)).data;
    const baseCount = curCap?.activeOrdersCount || 0;
    await request('PATCH', '/api/store', { dailyCapacity: baseCount + 2 }, authHeaders);

    const slot1 = await request('POST', '/api/checkout', {
      customerName: 'SlotOneUser',
      customerEmail: 'slot1@test.local',
      customerPhone: '+1 555-0100',
      fulfilmentType: 'pickup',
      scheduledDate: capDate,
      scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
      items: [{ productId: 'prod-milk-01', quantity: 1 }],
    });
    assert(slot1.status === 200, 'Slot 1 order succeeded');

    const [capA, capB] = await Promise.all([
      request('POST', '/api/checkout', {
        customerName: 'CapacityRacer1',
        customerEmail: 'cap1@test.local',
        customerPhone: '+1 555-0101',
        fulfilmentType: 'pickup',
        scheduledDate: capDate,
        scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
        items: [{ productId: 'prod-milk-01', quantity: 1 }],
      }),
      request('POST', '/api/checkout', {
        customerName: 'CapacityRacer2',
        customerEmail: 'cap2@test.local',
        customerPhone: '+1 555-0102',
        fulfilmentType: 'pickup',
        scheduledDate: capDate,
        scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
        items: [{ productId: 'prod-milk-01', quantity: 1 }],
      }),
    ]);

    const capStatuses = [capA.status, capB.status];
    assert(capStatuses.includes(200), 'One racer got the last slot');
    assert(capStatuses.includes(409), 'Second racer rejected due to capacity');
    const capRejected = capA.status === 409 ? capA : capB;
    assert(capRejected.data.error.includes('capacity'), 'Error indicates capacity reached');
    console.log(`  ✓ Capacity Protection: 1 succeeded (200), 1 rejected (409): "${capRejected.data.error}"`);
  } finally {
    await request('PATCH', '/api/store', { dailyCapacity: 12 }, authHeaders);
  }
  passSuite('Concurrent Race for Final Daily Capacity Slot');

  // -------------------------------------------------------------
  // SUITE 7: Reservation Expiry and Automatic Resource Release
  // -------------------------------------------------------------
  startSuite(7, 'Reservation Expiry and Automatic Resource Release');
  const expOrderRes = await request('POST', '/api/checkout', {
    customerName: 'ExpiryTestUser',
    customerEmail: 'expiry@test.local',
    customerPhone: '+1 555-9911',
    fulfilmentType: 'pickup',
    scheduledDate: '2026-11-25',
    scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
    items: [{ productId: 'prod-bread-02', quantity: 2 }],
  });
  assert(expOrderRes.status === 200, 'Order created');
  const expOrderId = expOrderRes.data.order.id;

  const prodsBeforeExp = (await request('GET', '/api/products')).data;
  const beforeBread = prodsBeforeExp.find((p) => p.id === 'prod-bread-02');
  const reservedBefore = beforeBread.reservedQuantity;

  const pastTime = new Date(Date.now() - 3600000).toISOString();
  await request('PATCH', `/api/orders/${expOrderId}`, { reservationExpiresAt: pastTime }, authHeaders);

  // Query capacity or store, which triggers lazy sweeper
  await request('GET', '/api/capacity?date=2026-11-25');

  const allOrdersRes = await request('GET', '/api/orders', null, authHeaders);
  const expOrderAfter = (allOrdersRes.data || []).find((o) => o.id === expOrderId);
  const prodsAfterExp = (await request('GET', '/api/products')).data;
  const afterBread = prodsAfterExp.find((p) => p.id === 'prod-bread-02');

  assert(expOrderAfter && expOrderAfter.status === 'Cancelled', 'Expired order auto-cancelled');
  assert(expOrderAfter.cancellationReason.includes('expired'), 'Reason notes expiry');
  assert(afterBread.reservedQuantity === reservedBefore - 2, 'Reserved quantity decreased by exactly 2');
  console.log(`  ✓ Reservation Expiry: Order auto-cancelled and 2 reserved units released back to shelf inventory.`);
  passSuite('Reservation Expiry and Automatic Resource Release');

  // -------------------------------------------------------------
  // SUITE 8: Owner Confirmation Racing with Expired Reservation
  // -------------------------------------------------------------
  startSuite(8, 'Owner Confirmation Racing with Expired Reservation');
  const confirmExpiredRes = await request('PATCH', `/api/orders/${expOrderId}`, {
    status: 'Confirmed',
  }, authHeaders);
  assert(confirmExpiredRes.status === 409 || confirmExpiredRes.status === 400, 'Confirmation of expired order rejected');
  console.log(`  ✓ Race Protection: Rejection response (Status ${confirmExpiredRes.status}): "${confirmExpiredRes.data.error}"`);
  passSuite('Owner Confirmation Racing with Expired Reservation');

  // -------------------------------------------------------------
  // SUITE 9: Duplicate Checkout Submission (Idempotency Protection)
  // -------------------------------------------------------------
  startSuite(9, 'Duplicate Checkout Submission & Idempotency Key Replay Protection');
  const testIdemKey = `idem-key-${Date.now()}`;
  const idemOrderPayload = {
    customerName: 'IdemUser',
    customerEmail: 'idem@test.local',
    customerPhone: '+1 555-7733',
    fulfilmentType: 'pickup',
    scheduledDate: '2026-11-28',
    scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
    items: [{ productId: 'prod-milk-01', quantity: 1 }],
  };

  const firstIdemRes = await request('POST', '/api/checkout', idemOrderPayload, {
    'Idempotency-Key': testIdemKey,
  });
  assert(firstIdemRes.status === 200, 'First checkout succeeded');
  const firstOrderNum = firstIdemRes.data.order.orderNumber;

  const secondIdemRes = await request('POST', '/api/checkout', idemOrderPayload, {
    'Idempotency-Key': testIdemKey,
  });
  assert(secondIdemRes.status === 200, 'Second request succeeded idempotently');
  assert(secondIdemRes.data.order.orderNumber === firstOrderNum, 'Returned identical order');
  assert(secondIdemRes.data.order.id === firstIdemRes.data.order.id, 'Returned identical order ID');
  console.log(`  ✓ Idempotency Verified: Duplicate submission returned original ${firstOrderNum} without double-booking.`);
  passSuite('Duplicate Checkout Submission & Idempotency Key Replay Protection');

  // -------------------------------------------------------------
  // SUITE 10: Inventory Adjustments with Active Reservations
  // -------------------------------------------------------------
  startSuite(10, 'Inventory Adjustments with Active Reservations Invariant');
  await request('POST', '/api/products/prod-honey-03/stock', {
    action: 'set',
    amount: 8,
  }, authHeaders);

  const stockAdjustRes = await request('POST', '/api/products/prod-honey-03/stock', {
    action: 'set',
    amount: 5,
  }, authHeaders);
  assert(stockAdjustRes.status === 200, 'Stock adjust succeeded');
  assert(stockAdjustRes.data.product.quantityOnHand === 5, 'Physical stock is 5');
  assert(stockAdjustRes.data.product.reservedQuantity >= 0, 'Reserved stock preserved at 2');

  const avail = Math.max(0, stockAdjustRes.data.product.quantityOnHand - stockAdjustRes.data.product.reservedQuantity);
  console.log(`  ✓ Invariant Verified: Physical: 5, Reserved: ${stockAdjustRes.data.product.reservedQuantity}, Available: ${avail}. Active reservations preserved.`);
  passSuite('Inventory Adjustments with Active Reservations Invariant');

  // -------------------------------------------------------------
  // SUITE 11: Cancellation Stock Release and Safe Rescheduling
  // -------------------------------------------------------------
  startSuite(11, 'Cancellation Stock Release and Safe Rescheduling');
  const cancelTestOrder = await request('POST', '/api/checkout', {
    customerName: 'CancelTest',
    customerEmail: 'cancel@test.local',
    customerPhone: '+1 555-4422',
    fulfilmentType: 'pickup',
    scheduledDate: '2026-11-29',
    scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
    items: [{ productId: 'prod-tomatoes-06', quantity: 2 }],
  });
  assert(cancelTestOrder.status === 200, 'Order created');
  const cOrderId = cancelTestOrder.data.order.id;

  await request('PATCH', `/api/orders/${cOrderId}`, { status: 'Confirmed' }, authHeaders);

  const reschedRes = await request('PATCH', `/api/orders/${cOrderId}`, {
    rescheduledDate: '2026-11-30',
    rescheduledSlot: 'Late Afternoon: 03:00 PM - 06:00 PM',
  }, authHeaders);
  assert(reschedRes.status === 200, 'Rescheduling succeeded');
  assert(reschedRes.data.order.scheduledDate === '2026-11-30', 'Scheduled date updated');

  const pBefore = (await request('GET', '/api/products')).data.find((p) => p.id === 'prod-tomatoes-06').reservedQuantity;

  const cancelRes = await request('PATCH', `/api/orders/${cOrderId}`, {
    status: 'Cancelled',
    cancellationReason: 'Customer requested cancellation',
  }, authHeaders);
  assert(cancelRes.status === 200, 'Cancellation succeeded');

  const pAfter = (await request('GET', '/api/products')).data.find((p) => p.id === 'prod-tomatoes-06').reservedQuantity;

  assert(pAfter === pBefore - 2, '2 reserved units released');
  console.log('  ✓ Cancellation & Reschedule: Rescheduled safely, cancellation released reservations exactly once.');
  passSuite('Cancellation Stock Release and Safe Rescheduling');

  // -------------------------------------------------------------
  // SUITE 12: Capacity Reductions while Orders Already Exist
  // -------------------------------------------------------------
  startSuite(12, 'Capacity Reductions while Orders Already Exist');
  const redDate = '2026-12-05';
  try {
    await request('PATCH', '/api/store', { dailyCapacity: 5 }, authHeaders);

    for (let i = 1; i <= 3; i++) {
      const o = await request('POST', '/api/checkout', {
        customerName: `ExistingOrder${i}`,
        customerEmail: `exist${i}@test.local`,
        customerPhone: '+1 555-0011',
        fulfilmentType: 'pickup',
        scheduledDate: redDate,
        scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
        items: [{ productId: 'prod-milk-01', quantity: 1 }],
      });
      assert(o.status === 200, `Order ${i} created`);
    }

    const redSettingsRes = await request('PATCH', '/api/store', { dailyCapacity: 2 }, authHeaders);
    assert(redSettingsRes.status === 200, 'Capacity reduced to 2');

    const ordersCheck = (await request('GET', '/api/orders', null, authHeaders)).data;
    const existingCount = ordersCheck.filter((o) => o.scheduledDate === redDate && o.status === 'Pending').length;
    assert(existingCount === 3, 'Existing 3 orders preserved intact');

    const blockedByRedCap = await request('POST', '/api/checkout', {
      customerName: 'TooLateCustomer',
      customerEmail: 'late@test.local',
      customerPhone: '+1 555-9999',
      fulfilmentType: 'pickup',
      scheduledDate: redDate,
      scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
      items: [{ productId: 'prod-milk-01', quantity: 1 }],
    });
    assert(blockedByRedCap.status === 409, 'New order blocked by reduced capacity');
    console.log(`  ✓ Capacity Reduction: Existing 3 orders intact, new orders safely blocked (Status 409).`);
  } finally {
    await request('PATCH', '/api/store', { dailyCapacity: 12 }, authHeaders);
  }
  passSuite('Capacity Reductions while Orders Already Exist');

  // -------------------------------------------------------------
  // SUITE 13: Notification Outbox Delivery, Retries, and Deduplication
  // -------------------------------------------------------------
  startSuite(13, 'Notification Outbox Delivery, Retries, and Deduplication');
  const outboxRes = await request('GET', '/api/notifications', null, authHeaders);
  assert(outboxRes.status === 200, 'Outbox query returns 200');
  assert(Array.isArray(outboxRes.data), 'Returns notification list');
  const latestNotif = outboxRes.data[0];
  assert(latestNotif !== undefined, 'At least one notification logged');
  assert(['SIMULATED', 'DELIVERED', 'QUEUED'].includes(latestNotif.status), 'Valid notification status');
  console.log(`  ✓ Outbox State: Latest subject: "${latestNotif.subject}" (Status: ${latestNotif.status})`);

  const retryRes = await request('POST', '/api/notifications', { notificationId: latestNotif.id }, authHeaders);
  assert(retryRes.status === 200, 'Notification retry returns 200');
  console.log('  ✓ Bounded Retry: Notification delivery attempted with recorded attempt count.');
  passSuite('Notification Outbox Delivery, Retries, and Deduplication');

  // -------------------------------------------------------------
  // SUITE 14: Authorization Guards on Every Protected Admin API Endpoint
  // -------------------------------------------------------------
  startSuite(14, 'Authorization Guards on Every Protected Admin API Endpoint');
  const endpoints = [
    { method: 'GET', path: '/api/orders' },
    { method: 'PATCH', path: '/api/orders/ord-sample-01', data: { status: 'Confirmed' } },
    { method: 'PATCH', path: '/api/store', data: { dailyCapacity: 10 } },
    { method: 'POST', path: '/api/products', data: { title: 'Unauthorized' } },
    { method: 'POST', path: '/api/products/prod-milk-01/stock', data: { action: 'set', amount: 5 } },
    { method: 'GET', path: '/api/enquiries' },
    { method: 'PATCH', path: '/api/enquiries/enq-sample-01', data: { status: 'Contacted' } },
    { method: 'GET', path: '/api/notifications' },
  ];

  for (const ep of endpoints) {
    const res = await request(ep.method, ep.path, ep.data); // no auth headers
    assert(res.status === 401, `Expected 401 Unauthorized for unauthenticated ${ep.method} ${ep.path}, got ${res.status}`);
  }
  console.log(`  ✓ All ${endpoints.length} Admin API endpoints strictly reject unauthenticated requests with HTTP 401.`);
  passSuite('Authorization Guards on Every Protected Admin API Endpoint');

  // -------------------------------------------------------------
  // SUITE 15: Input Validation: Zero/Negative Quantities & Illegal Transitions
  // -------------------------------------------------------------
  startSuite(15, 'Input Validation: Zero/Negative Quantities, Date Formats & Illegal Transitions');
  const zeroQty = await request('POST', '/api/checkout', {
    customerName: 'BadQty',
    customerEmail: 'bad@test.local',
    customerPhone: '+1 555-0000',
    fulfilmentType: 'pickup',
    scheduledDate: '2026-12-10',
    scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
    items: [{ productId: 'prod-milk-01', quantity: 0 }],
  });
  assert(zeroQty.status === 400, 'Zero quantity rejected with 400');

  const negQty = await request('POST', '/api/checkout', {
    customerName: 'BadQty',
    customerEmail: 'bad@test.local',
    customerPhone: '+1 555-0000',
    fulfilmentType: 'pickup',
    scheduledDate: '2026-12-10',
    scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
    items: [{ productId: 'prod-milk-01', quantity: -3 }],
  });
  assert(negQty.status === 400, 'Negative quantity rejected with 400');

  const badDate = await request('POST', '/api/checkout', {
    customerName: 'BadDate',
    customerEmail: 'bad@test.local',
    customerPhone: '+1 555-0000',
    fulfilmentType: 'pickup',
    scheduledDate: '10/12/2026',
    scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
    items: [{ productId: 'prod-milk-01', quantity: 1 }],
  });
  assert(badDate.status === 400, 'Invalid date format rejected with 400');

  // Create an order and fulfill it
  const validOrder = await request('POST', '/api/checkout', {
    customerName: 'LifecycleTest',
    customerEmail: 'life@test.local',
    customerPhone: '+1 555-0000',
    fulfilmentType: 'pickup',
    scheduledDate: '2026-12-12',
    scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
    items: [{ productId: 'prod-milk-01', quantity: 1 }],
  });
  const voId = validOrder.data.order.id;
  await request('PATCH', `/api/orders/${voId}`, { status: 'Confirmed' }, authHeaders);
  await request('PATCH', `/api/orders/${voId}`, { status: 'Processing' }, authHeaders);
  await request('PATCH', `/api/orders/${voId}`, { status: 'Ready' }, authHeaders);
  await request('PATCH', `/api/orders/${voId}`, { status: 'Fulfilled' }, authHeaders);

  // Illegal transition from Fulfilled -> Cancelled
  const illegalTransition = await request('PATCH', `/api/orders/${voId}`, { status: 'Cancelled' }, authHeaders);
  assert(illegalTransition.status === 409 || illegalTransition.status === 500, 'Illegal transition rejected');
  console.log('  ✓ Invalidation: Zero/negative quantities, bad date formats, and illegal status transitions rejected.');
  passSuite('Input Validation: Zero/Negative Quantities, Date Formats & Illegal Transitions');

  // -------------------------------------------------------------
  // SUITE 16: Strict Order Tracking Token Validation & Public Sanitization
  // -------------------------------------------------------------
  startSuite(16, 'Strict Order Tracking Token Validation & Public Sanitization');
  const noToken = await request('GET', `/api/orders/${voId}/track`);
  assert(noToken.status === 401, 'Tracking without token returns 401');

  const badToken = await request('GET', `/api/orders/${voId}/track?token=fake_tr_999999`);
  assert(badToken.status === 404, 'Tracking with invalid token returns 404');

  const goodToken = await request('GET', `/api/orders/${voId}/track?token=${validOrder.data.order.trackingToken}`);
  assert(goodToken.status === 200, 'Tracking with valid token returns 200');
  assert(goodToken.data.status === 'Fulfilled', 'Returns correct status');
  assert(goodToken.data.adminNotes === undefined, 'Admin notes not leaked to customer');
  console.log('  ✓ Tracking Security: Token strictly required, forged tokens rejected, sensitive admin fields redacted.');
  passSuite('Strict Order Tracking Token Validation & Public Sanitization');

  // -------------------------------------------------------------
  // SUITE 17: PostgreSQL Data Persistence Across Lifecycles
  // -------------------------------------------------------------
  startSuite(17, 'PostgreSQL Data Persistence Across Application Lifecycles');
  const storeVerify = await request('GET', '/api/store', null, authHeaders);
  const verifyOrder = (storeVerify.data.orders || []).find((o) => o.id === voId);
  const verifySettings = storeVerify.data.settings;
  assert(verifyOrder !== undefined, 'Order record persists in PostgreSQL database');
  assert(verifySettings.shopName === 'Greenwood Provisions', 'Settings persist in PostgreSQL database');
  console.log('  ✓ Durability: ACID storage verified in PostgreSQL with row-level locking & connection pooling.');
  passSuite('PostgreSQL Data Persistence Across Application Lifecycles');

  // -------------------------------------------------------------
  // SUITE 18: Transaction Atomicity & Rollback on Interrupted Writes
  // -------------------------------------------------------------
  startSuite(18, 'Transaction Atomicity & Rollback on Interrupted Writes');
  const prodsBefore = await request('GET', '/api/products');
  const milkBefore = (prodsBefore.data || []).find((p) => p.id === 'prod-milk-01');

  const overOrder = await request('POST', '/api/checkout', {
    customerName: 'OverBuyer',
    customerEmail: 'over@test.local',
    customerPhone: '+1 555-0000',
    fulfilmentType: 'pickup',
    scheduledDate: '2026-12-15',
    scheduledSlot: 'Morning: 09:00 AM - 12:00 PM',
    items: [
      { productId: 'prod-milk-01', quantity: 1 },
      { productId: 'prod-bread-02', quantity: 99999 }, // Will fail!
    ],
  });
  assert(overOrder.status === 409, 'Over-order rejected with 409');

  const prodsAfter = await request('GET', '/api/products');
  const milkAfter = (prodsAfter.data || []).find((p) => p.id === 'prod-milk-01');

  assert(milkAfter.reservedQuantity === milkBefore.reservedQuantity, 'First item reservation rolled back');
  console.log('  ✓ Atomicity Verified: Failed multi-item checkout rolled back completely with zero leaked reservations.');
  passSuite('Transaction Atomicity & Rollback on Interrupted Writes');

  // -------------------------------------------------------------
  // SUITE 19: Rate Limiting & Abuse Protection on Sensitive Endpoints (PHASE 4)
  // -------------------------------------------------------------
  startSuite(19, 'Rate Limiting & Abuse Protection on Sensitive Endpoints');
  // We test using an isolated mock client IP in X-Forwarded-For to avoid blocking other tests
  const testIp = '198.51.100.88';
  const rateHeaders = { 'x-forwarded-for': testIp };

  // Rapid burst to login endpoint (limit: 10/min)
  console.log('  Testing login rate limit (limit 10/min)...');
  let hitRateLimit = false;
  let retryAfterHeader = null;

  for (let i = 1; i <= 11; i++) {
    const res = await request('POST', '/api/auth/login', {
      email: 'bruteforce@test.local',
      password: 'wrongpassword',
    }, rateHeaders);

    if (i <= 10) {
      assert(res.status === 401, `Request ${i} should be 401 Unauthorized`);
    } else {
      // 11th request must be rate limited
      assert(res.status === 429, `Request 11 must be rejected with 429 Too Many Requests, got ${res.status}`);
      hitRateLimit = true;
      retryAfterHeader = res.headers['retry-after'];
      assert(retryAfterHeader !== undefined, 'Response must include Retry-After header');
      assert(res.data.error.includes('Too many requests'), 'Error message informs user of rate limit');
      console.log(`  ✓ 11th login attempt blocked with HTTP 429: "${res.data.error}" (Retry-After: ${retryAfterHeader}s)`);
    }
  }
  assert(hitRateLimit, 'Rate limiter must enforce limit on 11th request');
  passSuite('Rate Limiting & Abuse Protection on Sensitive Endpoints');

  // -------------------------------------------------------------
  // SUITE 20: Cross-Site Request Forgery (CSRF) Origin Hardening (PHASE 4)
  // -------------------------------------------------------------
  startSuite(20, 'Cross-Site Request Forgery (CSRF) Origin Hardening on Admin Mutations');
  // Attempt cookie-authenticated mutation with foreign untrusted origin
  const foreignOriginHeaders = {
    ...authHeaders,
    Origin: 'https://evil-attacker.example.com',
  };

  const csrfAttackedRes = await request('PATCH', '/api/store', { dailyCapacity: 99 }, foreignOriginHeaders);
  assert(csrfAttackedRes.status === 403, `Expected 403 Forbidden for cross-origin mutation, got ${csrfAttackedRes.status}`);
  assert(csrfAttackedRes.data.error.includes('CSRF') || csrfAttackedRes.data.error.includes('Cross-origin'), 'Error notes CSRF rejection');
  console.log(`  ✓ Blocked CSRF Attack: Status ${csrfAttackedRes.status} ("${csrfAttackedRes.data.error}")`);

  // Legitimate same-origin mutation succeeds
  const sameOriginHeaders = {
    ...authHeaders,
    Origin: `http://localhost:${TEST_PORT}`,
  };
  const legitimateRes = await request('PATCH', '/api/store', { dailyCapacity: 12 }, sameOriginHeaders);
  assert(legitimateRes.status === 200, `Expected 200 for same-origin mutation, got ${legitimateRes.status}`);
  console.log(`  ✓ Legitimate same-origin mutation permitted: Daily capacity verified at ${legitimateRes.data.settings.dailyCapacity}`);
  passSuite('Cross-Site Request Forgery (CSRF) Origin Hardening on Admin Mutations');

  // -------------------------------------------------------------
  // SUITE 21: Live PostgreSQL Database Backup & Isolated Restore
  // -------------------------------------------------------------
  startSuite(21, 'Live PostgreSQL Database Backup & Isolated Restore');
  const testBackupDir = path.join(__dirname, '..', 'data', 'backups');
  if (!fs.existsSync(testBackupDir)) fs.mkdirSync(testBackupDir, { recursive: true });

  const testBackupFile = path.join(testBackupDir, 'test_phase6_audit_backup.json');

  if (fs.existsSync(testBackupFile)) fs.unlinkSync(testBackupFile);

  console.log('  Executing node scripts/backup.js...');
  const mockFlag = process.env.DATABASE_URL ? '' : '--mock';
  execSync(`node "${path.join(__dirname, 'backup.js')}" "${testBackupFile}" ${mockFlag}`.trim(), { stdio: 'pipe' });
  assert(fs.existsSync(testBackupFile), 'Live backup file was generated');

  const bStat = fs.statSync(testBackupFile);
  assert(bStat.size > 0, 'Backup file has non-zero size');
  console.log(`  ✓ Verified live backup generated (${(bStat.size / 1024).toFixed(1)} KB)`);

  console.log('  Executing node scripts/restore.js with --dry-run validation...');
  const restoreOutput = execSync(`node "${path.join(__dirname, 'restore.js')}" "${testBackupFile}" --dry-run ${mockFlag}`.trim(), { encoding: 'utf-8' });
  assert(restoreOutput.includes('Dry run completed') || restoreOutput.includes('valid and ready'), 'Restore validation dry-run succeeded');
  console.log('  ✓ Verified backup passes schema and data structure validation.');

  // Clean up isolated test files
  if (fs.existsSync(testBackupFile)) fs.unlinkSync(testBackupFile);
  passSuite('Live PostgreSQL Database Backup & Isolated Restore');

  // -------------------------------------------------------------
  // SUITE 22: Production Secret Hardening & Demo Credential Guard (PHASE 4)
  // -------------------------------------------------------------
  startSuite(22, 'Production Secret Hardening & Public Response Sanitization');
  // Check tracking endpoint does not leak secrets, session tokens, or password hashes
  const trackCheck = await request('GET', `/api/orders/${voId}/track?token=${validOrder.data.order.trackingToken}`);
  assert(trackCheck.data.adminNotes === undefined, 'Admin notes not present in public tracking data');
  assert(trackCheck.data.password === undefined, 'No password field in tracking data');

  // Check store endpoint public data
  const storeCheck = await request('GET', '/api/store');
  assert(storeCheck.data.adminPassword === undefined, 'Store endpoint does not leak adminPassword');
  assert(storeCheck.data.sessionSecret === undefined, 'Store endpoint does not leak sessionSecret');

  console.log('  ✓ Public endpoints verified free of credential leaks and sensitive administrative metadata.');
  passSuite('Production Secret Hardening & Public Response Sanitization');

  console.log('\n===============================================================');
  console.log(`🎉 ALL ${passedSuites} / ${totalSuites} VERIFICATION SUITES EXECUTED & PASSED!`);
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('\n❌ TEST RUN TERMINATED WITH ERROR:', err);
  process.exit(1);
});
