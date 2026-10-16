import { NextResponse } from 'next/server';
import { checkAdminCredentials, createSessionToken, getAdminEmail } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // 1. Enforce Rate Limiting (Abuse & Brute-Force Protection)
    const rateLimitResponse = await enforceRateLimit(request, 'login', {
      limit: 10,
      windowMs: 60000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { email, password } = await request.json();

    const isValid = checkAdminCredentials(email, password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const adminEmail = email?.toLowerCase().trim() || getAdminEmail();
    const token = createSessionToken(adminEmail, 'Shopkeeper Admin');

    const response = NextResponse.json({
      success: true,
      user: {
        email: adminEmail,
        role: 'Shopkeeper Admin',
        shopName: 'Greenwood Provisions',
      },
    });

    // Set secure, tamper-proof session cookie (adaptive for cross-origin or same-site)
    const isCrossOrigin = process.env.CROSS_ORIGIN_COOKIES === 'true';
    response.cookies.set('shopsync_session', token, {
      httpOnly: true,
      path: '/',
      maxAge: 86400 * 7, // 7 days
      sameSite: isCrossOrigin ? 'none' : 'lax',
      secure: isCrossOrigin ? true : process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
