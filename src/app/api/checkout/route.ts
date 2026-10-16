import { NextResponse } from 'next/server';
import { createOrderAtomic } from '@/lib/storage';
import { enforceRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, 'checkout', {
      limit: 40,
      windowMs: 60000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const idempotencyKey =
      request.headers.get('idempotency-key') ||
      request.headers.get('x-idempotency-key') ||
      undefined;

    const body = await request.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      fulfilmentType,
      deliveryAddress,
      scheduledDate,
      scheduledSlot,
      items,
      customerNotes,
      idempotencyKey: bodyKey,
    } = body;

    const finalIdempotencyKey = idempotencyKey || bodyKey;

    // Contact info validation
    if (!customerName || !customerEmail || !customerPhone) {
      return NextResponse.json(
        { error: 'Please provide customer name, email, and phone number.' },
        { status: 400 }
      );
    }

    // Email format validation
    if (!customerEmail.includes('@') || !customerEmail.includes('.')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    // Date & Slot validation
    if (!scheduledDate || !scheduledSlot) {
      return NextResponse.json(
        { error: 'Please select a scheduled fulfilment date and time slot.' },
        { status: 400 }
      );
    }

    // Verify scheduled date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      return NextResponse.json(
        { error: 'Invalid scheduled date format. Expected YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Cart validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
    }

    for (const it of items) {
      if (!it.productId || typeof it.quantity !== 'number' || it.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each order item must have a valid productId and quantity of at least 1.' },
          { status: 400 }
        );
      }
    }

    if (fulfilmentType === 'delivery' && !deliveryAddress?.trim()) {
      return NextResponse.json(
        { error: 'Delivery address is required for local delivery.' },
        { status: 400 }
      );
    }

    const result = await createOrderAtomic(
      {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        customerPhone: customerPhone.trim(),
        fulfilmentType: fulfilmentType || 'pickup',
        deliveryAddress: deliveryAddress ? deliveryAddress.trim() : undefined,
        scheduledDate,
        scheduledSlot,
        items,
        customerNotes,
      },
      finalIdempotencyKey
    );

    if (!result.success) {
      return NextResponse.json({ error: result.errorMessage }, { status: 409 });
    }

    return NextResponse.json({ success: true, order: result.order });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
