import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get('shopsync_session');

  if (session && session.value === 'authenticated_admin') {
    return NextResponse.json({
      authenticated: true,
      user: {
        email: 'admin@greenwood.local',
        role: 'Shopkeeper Admin',
        shopName: 'Greenwood Provisions',
      },
    });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
