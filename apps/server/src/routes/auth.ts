import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  createSession,
  deleteSession,
  loginUser,
  parseCookie,
  registerUser,
  resolveAuthRedirect,
  SESSION_COOKIE,
} from '../services/authService.js'
import { sendError } from '../utils/errors.js'
import type { PaginationQuery } from '../utils/pagination.js'

interface RegisterBody {
  user?: {
    name?: string
    email?: string
    type?: string
    credential?: string
  }
}

interface LoginBody {
  email?: string
  password?: string
}

export function registerAuthRoutes(app: FastifyInstance): void {
  // ── Public: Settings ──────────────────────────────────────────────
  app.get('/api/v1/settings', async (_request, reply) => {
    return reply.code(200).send({ PLATFORM_TYPE: 'open source' })
  })

  // ── Public: Basic auth check ──────────────────────────────────────
  app.get('/api/v1/account/basic-auth', async (_request, reply) => {
    return reply.code(200).send({ status: false })
  })

  // ── Public: Auth resolve ──────────────────────────────────────────
  app.post('/api/v1/auth/resolve', async (request, reply) => {
    const token = parseCookie(request.headers.cookie, SESSION_COOKIE)
    const result = resolveAuthRedirect(token)
    return reply.code(200).send(result)
  })

  // ── Public: Register ──────────────────────────────────────────────
  app.post('/api/v1/account/register', async (request: FastifyRequest<{ Body: RegisterBody }>, reply) => {
    const { body } = request

    if (!body?.user) {
      return sendError(reply, 400, 'Request body must contain a user object')
    }

    const { name, email, credential } = body.user
    if (!name || !email || !credential) {
      return sendError(reply, 400, 'name, email, and credential are required')
    }

    try {
      const result = registerUser({ name, email, credential })
      return reply.code(201).send(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      return sendError(reply, 400, message)
    }
  })

  // ── Public: Login ─────────────────────────────────────────────────
  app.post('/api/v1/auth/login', async (request: FastifyRequest<{ Body: LoginBody }>, reply) => {
    const { body } = request

    if (!body?.email || !body?.password) {
      return sendError(reply, 400, 'email and password are required')
    }

    const result = loginUser(body.email, body.password)
    if (!result) {
      return sendError(reply, 401, 'Invalid email or password')
    }

    const sessionToken = createSession(result.id)

    reply.header('set-cookie', `${SESSION_COOKIE}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`)
    return reply.code(200).send(result)
  })

  // ── Logout ────────────────────────────────────────────────────────
  app.post('/api/v1/account/logout', async (request, reply) => {
    const token = parseCookie(request.headers.cookie, SESSION_COOKIE)
    if (token) {
      deleteSession(token)
    }

    reply.header('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
    return reply.code(200).send({ message: 'logged_out', redirectTo: '/login' })
  })

  // ── Permissions check ─────────────────────────────────────────────
  app.get('/api/v1/auth/permissions/:name', async (_request: FastifyRequest<{ Params: { name: string } }>, reply) => {
    // Stub: all features authorized (single-tenant, no RBAC yet)
    return reply.code(200).send({ authorized: true })
  })

  // ── Version ───────────────────────────────────────────────────────
  app.get('/api/v1/version', async (_request, reply) => {
    return reply.code(200).send({ version: '3.0.13' })
  })

  // ── Executions (stub — paginated empty list) ─────────────────────
  app.get('/api/v1/executions', async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply) => {
    const { query } = request
    if (query.page != null) {
      return reply.code(200).send({ data: [], total: 0 })
    }
    return reply.code(200).send([])
  })
}
