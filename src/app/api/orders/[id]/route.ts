import { NextResponse } from 'next/server';
import { updateOrderStatus } from '@/lib/storage';
import { requireAdminAuth } from '@/lib/auth';
import { OrderStatus } from '@/types';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authCheck = requireAdminAuth(request);
    if (!authCheck.authorized) {
      return authCheck.response!;
    }

    const { id } = params;
    const body = await request.json();
    const { status, adminNotes, cancellationReason, rescheduledDate, rescheduledSlot, reservationExpiresAt } = body;

    const validStatuses: OrderStatus[] = [
      'Pending',
      'Confirmed',
      'Processing',
      'Ready',
      'Fulfilled',
      'Cancelled',
      'PENDING_REVIEW',
      'CONFIRMED',
      'RESCHEDULED',
      'READY_FOR_PICKUP',
      'COMPLETED',
      'REJECTED',
      'CANCELLED',
    ];

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const updatedOrder = await updateOrderStatus(id, status, {
      adminNotes,
      cancellationReason,
      rescheduledDate,
      rescheduledSlot,
      reservationExpiresAt,
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update order';
    // If business logic error (e.g. invalid transition, expired reservation, capacity full), return 409
    const isConflict =
      message.includes('capacity') ||
      message.includes('expired') ||
      message.includes('Invalid status transition');
    return NextResponse.json({ error: message }, { status: isConflict ? 409 : 500 });
  }
}
