export interface User {
  id: string
  name: string
  email: string
  status: 'active' | 'inactive'
  /** scrypt hash of the password */
  passwordHash: string
  createdBy: string
  updatedBy: string
  createdDate: string
  updatedDate: string
}

const store = new Map<string, User>()

export function getAllUsers(): User[] {
  return Array.from(store.values())
}

export function getUserById(id: string): User | undefined {
  return store.get(id)
}

export function getUserByEmail(email: string): User | undefined {
  for (const user of store.values()) {
    if (user.email === email) return user
  }
  return undefined
}

export function setUser(user: User): void {
  store.set(user.id, user)
}

export function userCount(): number {
  return store.size
}

export function clearUserStore(): void {
  store.clear()
}
