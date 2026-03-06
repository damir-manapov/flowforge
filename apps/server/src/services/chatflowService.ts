export type { Chatflow } from '../storage/inMemoryStore.js'
export {
  createChatflow,
  deleteChatflow,
  getAllChatflows,
  getChatflowById,
  updateChatflow,
} from '../storage/inMemoryStore.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value)
}
