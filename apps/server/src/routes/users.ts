import type { FastifyInstance, FastifyRequest } from 'fastify'
import { changeUserPassword, getUserById, updateUserProfile } from '../services/authService.js'
import { sendError } from '../utils/errors.js'

interface UserQuery {
  id?: string
}

interface ProfileBody {
  id?: string
  name?: string
  email?: string
  oldPassword?: string
  newPassword?: string
  confirmPassword?: string
}

export function registerUserRoutes(app: FastifyInstance): void {
  // ── Get user profile ──────────────────────────────────────────────
  app.get('/api/v1/user', async (request: FastifyRequest<{ Querystring: UserQuery }>, reply) => {
    const { id } = request.query

    if (!id) {
      return sendError(reply, 400, 'User id is required')
    }

    const user = getUserById(id)
    if (!user) {
      return sendError(reply, 404, 'User not found')
    }

    // Return profile without passwordHash
    return reply.code(200).send({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      createdDate: user.createdDate,
      updatedDate: user.updatedDate,
    })
  })

  // ── Update user profile or password ───────────────────────────────
  app.put('/api/v1/user', async (request: FastifyRequest<{ Body: ProfileBody }>, reply) => {
    const { body } = request

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    if (!body.id) {
      return sendError(reply, 400, 'User id is required')
    }

    // Password change
    if (body.oldPassword && body.newPassword) {
      const result = changeUserPassword({
        id: body.id,
        oldPassword: body.oldPassword,
        newPassword: body.newPassword,
        confirmPassword: body.confirmPassword ?? body.newPassword,
      })

      if (!result.success) {
        return sendError(reply, 400, result.error ?? 'Password change failed')
      }

      return reply.code(200).send({ message: 'Password updated successfully' })
    }

    // Profile update
    const updated = updateUserProfile({
      id: body.id,
      name: body.name,
      email: body.email,
    })

    if (!updated) {
      return sendError(reply, 404, 'User not found')
    }

    return reply.code(200).send({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      status: updated.status,
      createdDate: updated.createdDate,
      updatedDate: updated.updatedDate,
    })
  })
}
