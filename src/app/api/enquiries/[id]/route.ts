import { NextResponse } from 'next/server';
import { updateEnquiryStatus } from '@/lib/storage';
import { requireAdminAuth } from '@/lib/auth';
import { EnquiryStatus } from '@/types';

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
    const { status, adminNotes } = body;

    const validStatuses: EnquiryStatus[] = [
      'New',
      'Contacted',
      'Resolved',
      'NEW',
      'IN_PROGRESS',
      'REPLIED',
      'CONVERTED',
      'ARCHIVED',
    ];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const updated = await updateEnquiryStatus(id, status, adminNotes);
    return NextResponse.json({ success: true, enquiry: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update enquiry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
