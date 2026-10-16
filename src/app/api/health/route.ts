import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const res = await query('SELECT 1 as alive;');
    const isHealthy = res.rows.length > 0 && Number(res.rows[0].alive) === 1;

    if (!isHealthy) {
      return NextResponse.json(
        {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          uptimeSec: Math.floor(process.uptime()),
        },
        { status: 503 }
      );
    }

    // Check if caller is authenticated admin requesting detailed system diagnostics
    const authCheck = requireAdminAuth(request);
    if (authCheck.authorized) {
      const verRes = await query('SELECT version();').catch(() => ({ rows: [{ version: 'PostgreSQL' }] }));
      return NextResponse.json(
        {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptimeSec: Math.floor(process.uptime()),
          diagnostics: {
            database: 'connected',
            engine: 'postgresql',
            version: verRes.rows[0]?.version?.split(' ')?.[0] || 'PostgreSQL',
          },
        },
        { status: 200 }
      );
    }

    // Hardened public response: clean status without leaking internal engine or DB diagnostics
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSec: Math.floor(process.uptime()),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptimeSec: Math.floor(process.uptime()),
      },
      { status: 503 }
    );
  }
}
