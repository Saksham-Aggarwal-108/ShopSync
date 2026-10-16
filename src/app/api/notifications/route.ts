import { NextResponse } from 'next/server';
import { getStoreData } from '@/lib/storage';
import { requireAdminAuth } from '@/lib/auth';
import { retryFailedNotifications, attemptDelivery } from '@/lib/notifications';
import { enforceRateLimit } from '@/lib/rateLimit';

export async function GET(request: Request) {
  try {
    const authCheck = requireAdminAuth(request);
    if (!authCheck.authorized) {
      return authCheck.response!;
    }

    const db = await getStoreData();
    return NextResponse.json(db.notificationLogs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch notification logs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, 'notifications-retry', {
      limit: 20,
      windowMs: 60000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authCheck = requireAdminAuth(request);
    if (!authCheck.authorized) {
      return authCheck.response!;
    }

    const body = await request.json().catch(() => ({}));
    const { notificationId } = body;

    if (notificationId) {
      const result = await attemptDelivery(notificationId);
      return NextResponse.json({ success: true, notification: result });
    }

    const retryResult = await retryFailedNotifications();
    return NextResponse.json({ success: true, ...retryResult });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process notification retry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
