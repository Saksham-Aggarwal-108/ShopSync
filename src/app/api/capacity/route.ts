import { NextResponse } from 'next/server';
import { getDailyCapacityStatus } from '@/lib/storage';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const capacityStatus = await getDailyCapacityStatus(date);
    return NextResponse.json(capacityStatus);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to query capacity';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
