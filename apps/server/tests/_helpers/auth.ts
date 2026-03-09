import type { FastifyInstance } from 'fastify'

/**
 * Register a test user and log in, returning the session cookie string.
 *
 * Use the returned cookie in `app.inject({ headers: { cookie } })` for
 * requests to protected routes.
 */
export async function registerAndLogin(
  app: FastifyInstance,
  email = 'admin@test.com',
  password = 'Pass123_',
): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/api/v1/account/register',
    payload: { user: { name: 'Admin', email, credential: password } },
  })

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  })

  const cookie = loginRes.headers['set-cookie']
  if (typeof cookie !== 'string') {
    throw new Error(`registerAndLogin: login did not return set-cookie (status ${loginRes.statusCode})`)
  }
  return cookie
}
