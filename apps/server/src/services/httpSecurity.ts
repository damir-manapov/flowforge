/**
 * HTTP security service — SSRF protection.
 *
 * Prevents server-side request forgery by blocking outbound HTTP/HTTPS
 * requests to private, loopback, and link-local IP addresses.
 *
 * Mirrors Flowise's httpSecurity.ts behaviour:
 * - isDeniedIP() checks against private ranges
 * - checkDenyList() resolves DNS then checks resulting IP
 * - secureFetch() wraps fetch with SSRF check
 *
 * Controlled by TOOL_FUNCTION_DENY_LIST env var for custom patterns.
 */

import { resolve4, resolve6 } from 'node:dns/promises'

// ── Private IP ranges ────────────────────────────────────────────────

/** Check if an IPv4 address is in a private/reserved range. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return false
  const [a, b] = parts as [number, number, number, number]

  // 10.0.0.0/8
  if (a === 10) return true
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true
  // 0.0.0.0
  if (a === 0 && b === 0 && parts[2] === 0 && parts[3] === 0) return true

  return false
}

/** Check if an IPv6 address is loopback or link-local. */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  // ::1 (loopback)
  if (normalized === '::1') return true
  // fe80::/10 (link-local)
  if (normalized.startsWith('fe80:')) return true
  // fc00::/7 (unique local)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  // ::ffff:x.x.x.x (IPv4-mapped IPv6) — check the IPv4 part
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.slice(7)
    if (isPrivateIPv4(v4Part)) return true
  }
  return false
}

/** Check if an IP address (v4 or v6) is in a denied (private/reserved) range. */
export function isDeniedIP(ip: string): boolean {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip)
}

// ── Custom deny list from environment ────────────────────────────────

function getDenyPatterns(): string[] {
  const raw = process.env.TOOL_FUNCTION_DENY_LIST
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Check hostname against TOOL_FUNCTION_DENY_LIST env var patterns. */
function isHostDenied(hostname: string): boolean {
  const patterns = getDenyPatterns()
  const lower = hostname.toLowerCase()
  return patterns.some((pattern) => lower.includes(pattern.toLowerCase()))
}

// ── DNS-based checking ───────────────────────────────────────────────

/**
 * Resolve a hostname to IP addresses and check if any are in denied ranges.
 * Throws if the hostname resolves to a private IP.
 */
export async function checkDenyList(hostname: string): Promise<void> {
  // Check custom deny list first
  if (isHostDenied(hostname)) {
    throw new Error(`Hostname ${hostname} is in the deny list`)
  }

  // If it looks like a raw IP, check directly
  if (isDeniedIP(hostname)) {
    throw new Error(`Request to private IP ${hostname} is not allowed`)
  }

  // DNS resolution check — try both A and AAAA records
  const ips: string[] = []
  try {
    ips.push(...(await resolve4(hostname)))
  } catch {
    /* no A records */
  }
  try {
    ips.push(...(await resolve6(hostname)))
  } catch {
    /* no AAAA records */
  }
  for (const ip of ips) {
    if (isDeniedIP(ip)) {
      throw new Error(`Hostname ${hostname} resolves to private IP ${ip} — request blocked`)
    }
  }
}

// ── Secure fetch wrapper ─────────────────────────────────────────────

/**
 * A fetch wrapper that checks the URL against SSRF deny rules before making the request.
 * Drop-in replacement for `fetch()`.
 */
export async function secureFetch(url: string | URL, options?: RequestInit): Promise<Response> {
  const parsed = typeof url === 'string' ? new URL(url) : url
  await checkDenyList(parsed.hostname)
  return fetch(parsed, options)
}
