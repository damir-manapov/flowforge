import { describe, expect, it } from 'vitest'
import { isDeniedIP } from '../src/services/httpSecurity.js'

describe('httpSecurity', () => {
  describe('isDeniedIP', () => {
    // ── Private IPv4 ───────────────────────────────────────────
    it('blocks 10.x.x.x (private class A)', () => {
      expect(isDeniedIP('10.0.0.1')).toBe(true)
      expect(isDeniedIP('10.255.255.255')).toBe(true)
    })

    it('blocks 172.16-31.x.x (private class B)', () => {
      expect(isDeniedIP('172.16.0.1')).toBe(true)
      expect(isDeniedIP('172.31.255.255')).toBe(true)
      // 172.15.x and 172.32.x are public
      expect(isDeniedIP('172.15.0.1')).toBe(false)
      expect(isDeniedIP('172.32.0.1')).toBe(false)
    })

    it('blocks 192.168.x.x (private class C)', () => {
      expect(isDeniedIP('192.168.0.1')).toBe(true)
      expect(isDeniedIP('192.168.255.255')).toBe(true)
    })

    it('blocks 127.x.x.x (loopback)', () => {
      expect(isDeniedIP('127.0.0.1')).toBe(true)
      expect(isDeniedIP('127.255.255.255')).toBe(true)
    })

    it('blocks 169.254.x.x (link-local)', () => {
      expect(isDeniedIP('169.254.0.1')).toBe(true)
      expect(isDeniedIP('169.254.169.254')).toBe(true) // AWS metadata
    })

    it('blocks 0.0.0.0', () => {
      expect(isDeniedIP('0.0.0.0')).toBe(true)
    })

    // ── Private IPv6 ───────────────────────────────────────────
    it('blocks ::1 (IPv6 loopback)', () => {
      expect(isDeniedIP('::1')).toBe(true)
    })

    it('blocks fe80:: (IPv6 link-local)', () => {
      expect(isDeniedIP('fe80::1')).toBe(true)
      expect(isDeniedIP('fe80::abcd:ef01:2345:6789')).toBe(true)
    })

    it('blocks fc/fd (IPv6 unique local)', () => {
      expect(isDeniedIP('fc00::1')).toBe(true)
      expect(isDeniedIP('fd12:3456::1')).toBe(true)
    })

    it('blocks IPv4-mapped IPv6 with private IPv4', () => {
      expect(isDeniedIP('::ffff:10.0.0.1')).toBe(true)
      expect(isDeniedIP('::ffff:192.168.1.1')).toBe(true)
      expect(isDeniedIP('::ffff:127.0.0.1')).toBe(true)
    })

    // ── Public addresses ───────────────────────────────────────
    it('allows public IPv4 addresses', () => {
      expect(isDeniedIP('8.8.8.8')).toBe(false)
      expect(isDeniedIP('1.1.1.1')).toBe(false)
      expect(isDeniedIP('142.250.80.46')).toBe(false)
    })

    it('allows public IPv6 addresses', () => {
      expect(isDeniedIP('2001:4860:4860::8888')).toBe(false)
    })

    it('allows IPv4-mapped IPv6 with public IPv4', () => {
      expect(isDeniedIP('::ffff:8.8.8.8')).toBe(false)
    })

    it('returns false for non-IP strings', () => {
      expect(isDeniedIP('not-an-ip')).toBe(false)
      expect(isDeniedIP('')).toBe(false)
    })
  })
})
