import { NextResponse } from 'next/server';
import { getProducts, saveProduct } from '@/lib/storage';
import { requireAdminAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const products = await getProducts(activeOnly);
    return NextResponse.json(products);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authCheck = requireAdminAuth(request);
    if (!authCheck.authorized) {
      return authCheck.response!;
    }

    const body = await request.json();

    if (body.price !== undefined && Number(body.price) < 0) {
      return NextResponse.json({ error: 'Product price cannot be negative' }, { status: 400 });
    }
    if (body.quantityOnHand !== undefined && Number(body.quantityOnHand) < 0) {
      return NextResponse.json({ error: 'Stock quantity cannot be negative' }, { status: 400 });
    }

    const product = await saveProduct(body);
    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
