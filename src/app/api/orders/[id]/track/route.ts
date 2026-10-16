import { NextResponse } from 'next/server';
import { getOrderByTracking } from '@/lib/storage';
import { enforceRateLimit } from '@/lib/rateLimit';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, 'tracking', {
      limit: 60,
      windowMs: 60000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Strict validation: token MUST be provided
    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: 'Tracking access token is required to view order status.' },
        { status: 401 }
      );
    }

    const order = await getOrderByTracking(id, token.trim());
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or invalid tracking token.' },
        { status: 404 }
      );
    }

    // Return sanitized customer-facing information (never leak adminNotes or internal secrets)
    return NextResponse.json({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      fulfilmentType: order.fulfilmentType,
      deliveryAddress: order.deliveryAddress,
      scheduledDate: order.scheduledDate,
      scheduledSlot: order.scheduledSlot,
      status: order.status,
      items: order.items,
      totalAmount: order.totalAmount,
      customerNotes: order.customerNotes,
      cancellationReason: order.cancellationReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to query order tracking';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
