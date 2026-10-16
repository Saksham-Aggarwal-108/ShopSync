import { NextResponse } from 'next/server';
import { getStoreData, submitEnquiryAtomic } from '@/lib/storage';
import { requireAdminAuth } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rateLimit';

export async function GET(request: Request) {
  try {
    const authCheck = requireAdminAuth(request);
    if (!authCheck.authorized) {
      return authCheck.response!;
    }

    const db = await getStoreData();
    return NextResponse.json(db.enquiries);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch enquiries';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, 'enquiries', {
      limit: 25,
      windowMs: 60000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { customerName, customerEmail, customerPhone, productId, message } = body;

    if (!customerName || !customerEmail || !customerPhone || !message?.trim()) {
      return NextResponse.json(
        { error: 'Please provide name, email, phone, and your question or inquiry.' },
        { status: 400 }
      );
    }

    if (!customerEmail.includes('@') || !customerEmail.includes('.')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const enquiry = await submitEnquiryAtomic({
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      customerPhone: customerPhone.trim(),
      productId,
      message: message.trim(),
    });

    return NextResponse.json({ success: true, enquiry });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit enquiry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
