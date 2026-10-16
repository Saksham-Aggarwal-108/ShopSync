import { NextResponse } from 'next/server';
import { getSettings, getProducts, getStoreData, updateSettings } from '@/lib/storage';
import { requireAdminAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authCheck = requireAdminAuth(request);
    if (authCheck.authorized) {
      // Authenticated admin receives full store state
      const fullData = await getStoreData();
      return NextResponse.json(fullData);
    }

    // Public visitor receives only public settings and products (no sensitive customer orders/enquiries/logs)
    const [settings, products] = await Promise.all([
      getSettings(),
      getProducts(false),
    ]);

    return NextResponse.json({
      settings,
      products,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch store data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authCheck = requireAdminAuth(request);
    if (!authCheck.authorized) {
      return authCheck.response!;
    }

    const body = await request.json();
    const updated = await updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
