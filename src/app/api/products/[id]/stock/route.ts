import { NextResponse } from 'next/server';
import { updateProductStock } from '@/lib/storage';
import { requireAdminAuth } from '@/lib/auth';

export async function POST(
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
    const { action, amount } = body;

    if (!['increment', 'decrement', 'set', 'toggle_out_of_stock'].includes(action)) {
      return NextResponse.json({ error: 'Invalid stock action' }, { status: 400 });
    }

    if (amount !== undefined && (typeof amount !== 'number' || amount < 0)) {
      return NextResponse.json({ error: 'Stock amount must be a non-negative number' }, { status: 400 });
    }

    const updatedProduct = await updateProductStock(id, action, amount);
    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update product stock';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
