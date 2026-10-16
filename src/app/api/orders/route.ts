import { NextResponse } from 'next/server';
import { getStoreData } from '@/lib/storage';
import { requireAdminAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authCheck = requireAdminAuth(request);
    if (!authCheck.authorized) {
      return authCheck.response!;
    }

    const db = await getStoreData();
    return NextResponse.json(db.orders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch orders';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
