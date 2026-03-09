/**
 * Vitest setupFile — runs once before test files.
 *
 * When TARGET_NAME !== 'reimpl', authenticates with Flowise 3.0:
 *   1. Checks /auth/resolve to see if a user exists
 *   2. Registers a user if needed (tolerates duplicates)
 *   3. Logs in and captures session cookies
 *   4. Adds Cookie + x-request-from headers to the shared HttpClient
 */
import { client, log, testConfig } from './setup.js'

const DEFAULT_EMAIL = 'admin@test.com'
const DEFAULT_PASSWORD = 'Admin123_'
const DEFAULT_NAME = 'Admin'

/** Module-level promise ensures login runs once per process, even with concurrent imports */
let loginPromise: Promise<void> | undefined

async function loginToFlowise(): Promise<void> {
  const email = process.env.FF_EMAIL ?? DEFAULT_EMAIL
  const password = process.env.FF_PASSWORD ?? DEFAULT_PASSWORD
  const name = process.env.FF_NAME ?? DEFAULT_NAME

  log.info(`Authenticating with Flowise at ${testConfig.baseUrl}`)

  // Step 1: Check if registration is needed
  const resolveRes = await fetch(`${testConfig.baseUrl}/auth/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const resolveBody = (await resolveRes.json()) as { redirectUrl?: string }

  if (resolveBody.redirectUrl === '/organization-setup') {
    // No user exists — attempt registration (tolerate duplicates from concurrent workers)
    log.info('No user registered, creating account…')
    const registerRes = await fetch(`${testConfig.baseUrl}/account/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: { name, email, type: 'pro', credential: password },
      }),
    })
    if (registerRes.status === 201) {
      log.info('User registered successfully')
    } else {
      const text = await registerRes.text()
      // Tolerate "UNIQUE constraint" errors — another worker already registered
      if (text.includes('UNIQUE') || text.includes('already')) {
        log.info('User already registered by another worker, continuing to login')
      } else {
        log.warn(`Registration returned ${registerRes.status}: ${text}`)
      }
    }
    // Wait briefly for any concurrent registrations to settle
    await new Promise((r) => setTimeout(r, 500))
  }

  // Step 2: Login with retry for SQLite concurrency issues
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= 3; attempt++) {
    const loginRes = await fetch(`${testConfig.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
    })

    if (loginRes.status === 200) {
      // Step 3: Extract cookies from Set-Cookie headers
      const setCookies = loginRes.headers.getSetCookie()
      if (setCookies.length === 0) {
        throw new Error('Login succeeded but no Set-Cookie headers returned')
      }

      const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ')
      log.info(`Got ${setCookies.length} auth cookies`)

      // Step 4: Add cookies + internal header to the shared client
      client.addDefaultHeaders({
        Cookie: cookieHeader,
        'x-request-from': 'internal',
      })
      return
    }

    const text = await loginRes.text()
    lastError = new Error(`Login attempt ${attempt} failed (${loginRes.status}): ${text}`)
    log.warn(lastError.message)
    await new Promise((r) => setTimeout(r, 500 * attempt))
  }

  throw lastError ?? new Error('Login failed after retries')
}

if (!loginPromise) {
  loginPromise = loginToFlowise()
}
await loginPromise
