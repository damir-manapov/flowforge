import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { getUserByEmail, getUserById, setUser, type User, userCount } from '../storage/userStore.js'

export type { User } from '../storage/userStore.js'
export { clearUserStore, getUserById, userCount } from '../storage/userStore.js'

// ── Password hashing ────────────────────────────────────────────────

const SCRYPT_KEY_LEN = 64
const SCRYPT_SALT_LEN = 16

export function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_LEN).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEY_LEN).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, SCRYPT_KEY_LEN)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

// ── Session management ──────────────────────────────────────────────

/** Map<sessionToken, userId> */
const sessions = new Map<string, string>()

export function createSession(userId: string): string {
  const token = randomUUID()
  sessions.set(token, userId)
  return token
}

export function getSessionUserId(token: string): string | undefined {
  return sessions.get(token)
}

export function deleteSession(token: string): void {
  sessions.delete(token)
}

export function clearAllSessions(): void {
  sessions.clear()
}

// ── Session cookie name (matches Flowise 3.0) ──────────────────────
export const SESSION_COOKIE = 'connect.sid'

/** Parse a cookie header and return the value for a given name. */
export function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${name}=`))
  if (!match) return undefined
  return match.split('=').slice(1).join('=').trim()
}

// ── Registration ────────────────────────────────────────────────────

interface RegisterInput {
  name: string
  email: string
  credential: string // password
}

export interface RegisterResult {
  user: {
    id: string
    name: string
    email: string
    status: string
    createdBy: string
    updatedBy: string
    createdDate: string
    updatedDate: string
  }
}

export function registerUser(input: RegisterInput): RegisterResult {
  if (getUserByEmail(input.email)) {
    throw new Error('Email already registered')
  }

  const id = randomUUID()
  const ts = new Date().toISOString()

  const user: User = {
    id,
    name: input.name,
    email: input.email,
    status: 'active',
    passwordHash: hashPassword(input.credential),
    createdBy: id,
    updatedBy: id,
    createdDate: ts,
    updatedDate: ts,
  }

  setUser(user)

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      createdBy: user.createdBy,
      updatedBy: user.updatedBy,
      createdDate: user.createdDate,
      updatedDate: user.updatedDate,
    },
  }
}

// ── Login ───────────────────────────────────────────────────────────

export interface LoginResult {
  id: string
  email: string
  name: string
  roleId: string
  activeOrganizationId: string
  activeWorkspaceId: string
  activeWorkspace: string
  assignedWorkspaces: Array<{
    id: string
    name: string
    role: string
    organizationId: string
  }>
  permissions: string[]
  features: Record<string, unknown>
  isSSO: boolean
  isOrganizationAdmin: boolean
}

/** Static IDs for the default org/workspace (simple single-tenant setup). */
const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001'
const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000002'
const DEFAULT_ROLE_ID = '00000000-0000-4000-8000-000000000003'

export function loginUser(email: string, password: string): LoginResult | undefined {
  const user = getUserByEmail(email)
  if (!user) return undefined
  if (!verifyPassword(password, user.passwordHash)) return undefined

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: DEFAULT_ROLE_ID,
    activeOrganizationId: DEFAULT_ORG_ID,
    activeWorkspaceId: DEFAULT_WORKSPACE_ID,
    activeWorkspace: 'Default Workspace',
    assignedWorkspaces: [
      {
        id: DEFAULT_WORKSPACE_ID,
        name: 'Default Workspace',
        role: 'owner',
        organizationId: DEFAULT_ORG_ID,
      },
    ],
    permissions: ['organization', 'workspace'],
    features: {},
    isSSO: false,
    isOrganizationAdmin: true,
  }
}

// ── Profile update ──────────────────────────────────────────────────

interface ProfileUpdate {
  id: string
  name?: string | undefined
  email?: string | undefined
}

interface PasswordUpdate {
  id: string
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export function updateUserProfile(input: ProfileUpdate): User | undefined {
  const user = getUserById(input.id)
  if (!user) return undefined

  const updated: User = {
    ...user,
    name: input.name ?? user.name,
    email: input.email ?? user.email,
    updatedBy: user.id,
    updatedDate: new Date().toISOString(),
  }

  setUser(updated)
  return updated
}

export function changeUserPassword(input: PasswordUpdate): { success: boolean; error?: string } {
  if (input.newPassword !== input.confirmPassword) {
    return { success: false, error: 'Passwords do not match' }
  }

  const user = getUserById(input.id)
  if (!user) return { success: false, error: 'User not found' }

  if (!verifyPassword(input.oldPassword, user.passwordHash)) {
    return { success: false, error: 'Incorrect old password' }
  }

  const updated: User = {
    ...user,
    passwordHash: hashPassword(input.newPassword),
    updatedBy: user.id,
    updatedDate: new Date().toISOString(),
  }

  setUser(updated)
  return { success: true }
}

// ── Auth resolve ────────────────────────────────────────────────────

export function resolveAuthRedirect(sessionToken: string | undefined): { redirectUrl: string } {
  // No users registered → first-time setup
  if (userCount() === 0) {
    return { redirectUrl: '/organization-setup' }
  }

  // Has session → go to chatflows
  if (sessionToken && getSessionUserId(sessionToken)) {
    return { redirectUrl: '/chatflows' }
  }

  // Not logged in → sign in
  return { redirectUrl: '/signin' }
}
