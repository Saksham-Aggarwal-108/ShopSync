/**
 * Environment-driven API client for ShopSync
 * Supports:
 * 1. Same-Origin / Next.js Rewrite Proxy (Default on Vercel with BACKEND_API_URL)
 * 2. Direct Cross-Origin API calls (when NEXT_PUBLIC_API_URL is explicitly configured)
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

export function apiFetch(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const isApiRoute = pathOrUrl.startsWith('/api') || pathOrUrl.startsWith('api/');
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;

  const targetUrl = isApiRoute && API_BASE_URL
    ? `${API_BASE_URL}${normalizedPath}`
    : normalizedPath;

  return fetch(targetUrl, {
    credentials: 'include',
    ...init,
  });
}
