import { getSessionUserId, parseCookie, SESSION_COOKIE } from '../services/authService.js'

// ── Public routes that bypass session auth ──────────────────────────

const PUBLIC_ROUTES = new Set([
  'GET /api/v1/ping',
  'GET /api/v1/settings',
  'GET /api/v1/account/basic-auth',
  'POST /api/v1/auth/resolve',
  'POST /api/v1/account/register',
  'POST /api/v1/auth/login',
])

/** Prefixes that use API key auth instead of session cookies. */
const API_KEY_PREFIXES = ['POST /api/v1/prediction/']

/**
 * Check whether a request targets a public route (no session required).
 *
 * Non-API routes (SPA fallback, static assets) are always public.
 * Prediction endpoints use API key auth handled by the route itself.
 */
export function isPublicRoute(method: string, url: string): boolean {
  const path = url.split('?')[0] ?? url
  if (!path.startsWith('/api/v1/')) return true
  const key = `${method} ${path}`
  if (PUBLIC_ROUTES.has(key)) return true
  return API_KEY_PREFIXES.some((p) => key.startsWith(p))
}

/**
 * Extract the authenticated user ID from the session cookie.
 * Returns `undefined` when no valid session exists.
 */
export function getAuthenticatedUserId(cookieHeader: string | undefined): string | undefined {
  const token = parseCookie(cookieHeader, SESSION_COOKIE)
  if (!token) return undefined
  return getSessionUserId(token)
}
