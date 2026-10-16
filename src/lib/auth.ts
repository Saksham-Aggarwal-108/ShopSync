import crypto from 'crypto';
import { NextResponse } from 'next/server';

// Environment-based admin credentials with fallback for development
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@greenwood.local').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shopsync2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'shopsync-super-secure-session-secret-2026';

// Warn if default credentials are used in production
if (IS_PRODUCTION && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'shopsync2026')) {
  console.warn('⚠️ SECURITY WARNING: ShopSync is running in production with default credentials. Set ADMIN_PASSWORD in environment!');
}

/**
 * Hash password using PBKDF2 with SHA-512 and random salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify password against stored salt:hash using constant-time comparison
 */
export function verifyPassword(password: string, storedHashOrPlain: string): boolean {
  if (storedHashOrPlain.includes(':')) {
    const [salt, originalHash] = storedHashOrPlain.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const origBuf = Buffer.from(originalHash, 'hex');
    if (hashBuf.length !== origBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, origBuf);
  }
  // Plaintext comparison with constant time buffer check
  const a = Buffer.from(password);
  const b = Buffer.from(storedHashOrPlain);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface SessionPayload {
  email: string;
  role: string;
  exp: number; // unix timestamp in seconds
}

/**
 * Create a signed, tamper-proof session token
 */
export function createSessionToken(email: string, role = 'Shopkeeper Admin'): string {
  const payload: SessionPayload = {
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + 7 * 86400, // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verify session token signature and expiration
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  // Legacy demo cookie compatibility in non-production
  if (!IS_PRODUCTION && token === 'authenticated_admin') {
    return {
      email: ADMIN_EMAIL,
      role: 'Shopkeeper Admin',
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
  }

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract session token from Request cookies or Authorization header
 */
export function extractSessionToken(request: Request): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Check Cookie header
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    if (c.startsWith('shopsync_session=')) {
      return decodeURIComponent(c.substring('shopsync_session='.length));
    }
  }

  return null;
}

const INSECURE_DEFAULT_PASSWORDS = ['shopsync2026', 'admin', 'password', '12345678'];
const INSECURE_DEFAULT_SECRETS = [
  'shopsync-super-secure-session-secret-2026',
  'shopsync-production-secret-replace-with-cryptographic-random-string',
  'secret',
];

/**
 * Validates that production environment is not using default or insecure secrets.
 */
export function validateProductionSecrets(env: NodeJS.ProcessEnv = process.env): { valid: boolean; error?: string } {
  const isProd = env.NODE_ENV === 'production';
  if (!isProd && env.STRICT_PRODUCTION_SECRETS !== 'true') return { valid: true };

  const adminPass = env.ADMIN_PASSWORD;
  const sessionSecret = env.SESSION_SECRET;

  if (!adminPass || INSECURE_DEFAULT_PASSWORDS.includes(adminPass)) {
    return {
      valid: false,
      error: 'Production configuration rejected: ADMIN_PASSWORD must be explicitly configured with a strong non-default secret.',
    };
  }
  if (!sessionSecret || INSECURE_DEFAULT_SECRETS.includes(sessionSecret)) {
    return {
      valid: false,
      error: 'Production configuration rejected: SESSION_SECRET must be explicitly configured with a cryptographically random string.',
    };
  }
  return { valid: true };
}

/**
 * Server-side authorization guard for admin endpoints with CSRF protection
 */
export function requireAdminAuth(request: Request): {
  authorized: boolean;
  user?: SessionPayload;
  response?: NextResponse;
} {
  // 1. CSRF Protection for state-changing mutation methods
  const method = request.method.toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        const isSameHost = originUrl.host === host;

        const allowedFrontend = process.env.FRONTEND_URL
          ? new URL(process.env.FRONTEND_URL).origin
          : null;
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
          .split(',')
          .map((o) => o.trim().replace(/\/$/, ''))
          .filter(Boolean);

        const isAllowedOrigin =
          (allowedFrontend && originUrl.origin === allowedFrontend) ||
          allowedOrigins.includes(originUrl.origin) ||
          (process.env.NODE_ENV !== 'production' &&
            (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1'));

        if (!isSameHost && !isAllowedOrigin) {
          return {
            authorized: false,
            response: NextResponse.json(
              { error: 'Forbidden. Cross-origin request blocked by CSRF protection.' },
              { status: 403 }
            ),
          };
        }
      } catch {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: 'Forbidden. Invalid origin header.' },
            { status: 403 }
          ),
        };
      }
    }
  }

  // 2. Authentication Token Check
  const token = extractSessionToken(request);
  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      ),
    };
  }

  const user = verifySessionToken(token);
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Session expired or invalid. Please log in again.' },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, user };
}

/**
 * Validate incoming login credentials against configured admin
 */
export function checkAdminCredentials(email?: string, password?: string): boolean {
  if (!email || !password) return false;
  if (email.toLowerCase().trim() !== ADMIN_EMAIL) return false;

  if (process.env.STRICT_PRODUCTION_SECRETS === 'true') {
    const secCheck = validateProductionSecrets();
    if (!secCheck.valid) {
      console.error(`[Security] ${secCheck.error}`);
      return false;
    }
  }

  return verifyPassword(password, ADMIN_PASSWORD);
}

export function getAdminEmail(): string {
  return ADMIN_EMAIL;
}
