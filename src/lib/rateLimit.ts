import { NextResponse } from 'next/server';
import { runTransaction } from './db';

export interface RateLimitOptions {
  limit: number; // Maximum allowed requests within the time window
  windowMs: number; // Time window duration in milliseconds
}

/**
 * Extracts client IP from standard HTTP headers with fallback to 127.0.0.1
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * PostgreSQL-backed atomic rate limiter.
 * Concurrency-safe across multi-process Node workers and persistent cloud backend instances.
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }> {
  const now = Date.now();

  return runTransaction(async (client) => {
    // Probabilistic cleanup of expired rate limit entries (5% chance per request)
    if (Math.random() < 0.05) {
      await client.query('DELETE FROM rate_limits WHERE expire_at < $1;', [now]).catch(() => {});
    }

    const selRes = await client.query(
      'SELECT points, expire_at FROM rate_limits WHERE key = $1 FOR UPDATE;',
      [key]
    );
    const row = selRes.rows[0];

    if (!row || Number(row.expire_at) <= now) {
      // First request or previous window expired
      const expireAt = now + options.windowMs;
      await client.query(
        `INSERT INTO rate_limits (key, points, expire_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE
         SET points = 1, expire_at = EXCLUDED.expire_at;`,
        [key, expireAt]
      );
      return { allowed: true, remaining: options.limit - 1, retryAfterSec: 0 };
    }

    const points = Number(row.points);
    const expireAt = Number(row.expire_at);

    if (points >= options.limit) {
      const retryAfterSec = Math.max(1, Math.ceil((expireAt - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    const newPoints = points + 1;
    await client.query('UPDATE rate_limits SET points = $1 WHERE key = $2;', [newPoints, key]);
    return { allowed: true, remaining: options.limit - newPoints, retryAfterSec: 0 };
  });
}

/**
 * Helper to check rate limit and return a 429 response if exceeded, or null if allowed.
 */
export async function enforceRateLimit(
  request: Request,
  action: string,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const key = `${action}:${ip}`;
  const result = await checkRateLimit(key, options);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: `Too many requests for ${action}. Please wait ${result.retryAfterSec} seconds before retrying.`,
        retryAfter: result.retryAfterSec,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSec),
          'X-RateLimit-Limit': String(options.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  return null;
}
