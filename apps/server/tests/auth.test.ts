import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../src/server.js'
import { clearAllSessions, clearUserStore, hashPassword, verifyPassword } from '../src/services/authService.js'
import { clearStore } from '../src/storage/inMemoryStore.js'

describe('auth service — password hashing', () => {
  it('hashes and verifies a password', () => {
    const hash = hashPassword('secret123')
    expect(hash).toContain(':')
    expect(verifyPassword('secret123', hash)).toBe(true)
    expect(verifyPassword('wrong', hash)).toBe(false)
  })

  it('produces different hashes for same password (random salt)', () => {
    const h1 = hashPassword('pass')
    const h2 = hashPassword('pass')
    expect(h1).not.toBe(h2)
  })
})

describe('auth routes (inject)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.stubEnv('LOG_LEVEL', 'silent')
    clearStore()
    clearUserStore()
    clearAllSessions()
    app = await buildServer()
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    clearStore()
    clearUserStore()
    clearAllSessions()
    vi.unstubAllEnvs()
  })

  // ── Settings ────────────────────────────────────────────────────

  describe('GET /settings', () => {
    it('returns platform type', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/settings' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ PLATFORM_TYPE: 'open source' })
    })
  })

  // ── Basic auth ──────────────────────────────────────────────────

  describe('GET /account/basic-auth', () => {
    it('returns status false', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/account/basic-auth' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ status: false })
    })
  })

  // ── Version ─────────────────────────────────────────────────────

  describe('GET /version', () => {
    it('returns version string', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/version' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.version).toBeDefined()
    })
  })

  // ── Auth resolve ────────────────────────────────────────────────

  describe('POST /auth/resolve', () => {
    it('returns organization-setup when no users exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resolve',
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ redirectUrl: '/organization-setup' })
    })

    it('returns signin when users exist but no session', async () => {
      // Register a user first
      await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'Admin', email: 'admin@test.com', credential: 'Pass123_' } },
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resolve',
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ redirectUrl: '/signin' })
    })

    it('returns chatflows when logged in', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'Admin', email: 'admin@test.com', credential: 'Pass123_' } },
      })

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'admin@test.com', password: 'Pass123_' },
      })

      const cookie = loginRes.headers['set-cookie'] as string
      expect(cookie).toBeDefined()

      const resolveRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resolve',
        payload: {},
        headers: { cookie },
      })
      expect(resolveRes.statusCode).toBe(200)
      expect(JSON.parse(resolveRes.body)).toEqual({ redirectUrl: '/chatflows' })
    })
  })

  // ── Register ────────────────────────────────────────────────────

  describe('POST /account/register', () => {
    it('creates a user and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'Admin', email: 'admin@test.com', credential: 'Pass123_' } },
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.user.name).toBe('Admin')
      expect(body.user.email).toBe('admin@test.com')
      expect(body.user.status).toBe('active')
      expect(body.user.id).toBeDefined()
      // Should NOT include password hash
      expect(body.user.passwordHash).toBeUndefined()
    })

    it('returns 400 for duplicate email', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'A', email: 'dup@test.com', credential: 'Pass123_' } },
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'B', email: 'dup@test.com', credential: 'Pass123_' } },
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when user object is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when fields are incomplete', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'A' } },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ── Login ───────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'Test', email: 'test@test.com', credential: 'Pass123_' } },
      })
    })

    it('returns user data and set-cookie header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'test@test.com', password: 'Pass123_' },
      })
      expect(res.statusCode).toBe(200)

      const body = JSON.parse(res.body)
      expect(body.email).toBe('test@test.com')
      expect(body.name).toBe('Test')
      expect(body.id).toBeDefined()
      expect(body.roleId).toBeDefined()
      expect(body.activeWorkspaceId).toBeDefined()
      expect(body.permissions).toEqual(['organization', 'workspace'])
      expect(body.isOrganizationAdmin).toBe(true)

      const cookie = res.headers['set-cookie'] as string
      expect(cookie).toContain('connect.sid=')
    })

    it('returns 401 for wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'test@test.com', password: 'wrong' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('returns 401 for non-existent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'nope@test.com', password: 'Pass123_' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('returns 400 for missing fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ── Logout ──────────────────────────────────────────────────────

  describe('POST /account/logout', () => {
    it('clears session and returns redirect', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/account/logout',
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.message).toBe('logged_out')
      expect(body.redirectTo).toBe('/login')

      const cookie = res.headers['set-cookie'] as string
      expect(cookie).toContain('Max-Age=0')
    })
  })

  // ── Permissions ─────────────────────────────────────────────────

  describe('GET /auth/permissions/:name', () => {
    it('returns authorized true', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/permissions/API_KEY',
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ authorized: true })
    })
  })

  // ── User profile ──────────────────────────────────────────────

  describe('GET /user', () => {
    it('returns user profile by id', async () => {
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'Profile', email: 'profile@test.com', credential: 'Pass123_' } },
      })
      const { user } = JSON.parse(regRes.body)

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/user?id=${user.id}`,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.name).toBe('Profile')
      expect(body.email).toBe('profile@test.com')
      // Should NOT include passwordHash
      expect(body.passwordHash).toBeUndefined()
    })

    it('returns 400 when id is missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/user' })
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for unknown user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/user?id=00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ── User profile update ───────────────────────────────────────

  describe('PUT /user', () => {
    let userId: string

    beforeEach(async () => {
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'Update', email: 'update@test.com', credential: 'Pass123_' } },
      })
      userId = JSON.parse(regRes.body).user.id
    })

    it('updates name and email', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/user',
        payload: { id: userId, name: 'New Name', email: 'new@test.com' },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.name).toBe('New Name')
      expect(body.email).toBe('new@test.com')
    })

    it('changes password', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/user',
        payload: {
          id: userId,
          oldPassword: 'Pass123_',
          newPassword: 'NewPass456_',
          confirmPassword: 'NewPass456_',
        },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).message).toBe('Password updated successfully')

      // Verify new password works
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'update@test.com', password: 'NewPass456_' },
      })
      expect(loginRes.statusCode).toBe(200)
    })

    it('returns 400 for wrong old password', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/user',
        payload: {
          id: userId,
          oldPassword: 'wrong',
          newPassword: 'NewPass456_',
          confirmPassword: 'NewPass456_',
        },
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when id is missing', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/user',
        payload: { name: 'No ID' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ── Full auth flow ────────────────────────────────────────────

  describe('full auth flow', () => {
    it('register → login → resolve → logout → resolve', async () => {
      // 1. Resolve: no users → setup
      const r1 = await app.inject({ method: 'POST', url: '/api/v1/auth/resolve', payload: {} })
      expect(JSON.parse(r1.body).redirectUrl).toBe('/organization-setup')

      // 2. Register
      const reg = await app.inject({
        method: 'POST',
        url: '/api/v1/account/register',
        payload: { user: { name: 'Flow', email: 'flow@test.com', credential: 'Pass123_' } },
      })
      expect(reg.statusCode).toBe(201)

      // 3. Resolve: users exist, not logged in → signin
      const r2 = await app.inject({ method: 'POST', url: '/api/v1/auth/resolve', payload: {} })
      expect(JSON.parse(r2.body).redirectUrl).toBe('/signin')

      // 4. Login
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'flow@test.com', password: 'Pass123_' },
      })
      expect(login.statusCode).toBe(200)
      const cookie = login.headers['set-cookie'] as string

      // 5. Resolve: logged in → chatflows
      const r3 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resolve',
        payload: {},
        headers: { cookie },
      })
      expect(JSON.parse(r3.body).redirectUrl).toBe('/chatflows')

      // 6. Logout
      const logout = await app.inject({
        method: 'POST',
        url: '/api/v1/account/logout',
        headers: { cookie },
      })
      expect(logout.statusCode).toBe(200)

      // 7. Resolve: logged out → signin
      const r4 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resolve',
        payload: {},
        headers: { cookie },
      })
      expect(JSON.parse(r4.body).redirectUrl).toBe('/signin')
    })
  })
})
