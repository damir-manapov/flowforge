/**
 * BufferMemory node — in-memory conversation message history.
 *
 * Matches the original Flowise BufferMemory node semantics.
 * Stores messages per session in memory.
 *
 * LangChain v1.x removed the legacy BufferMemory class.
 * We implement the same interface using a simple message store.
 */

import type { BaseMessage } from '@langchain/core/messages'
import type { NodeData } from '../nodeRegistry.js'

export interface FlowMemory {
  memoryKey: string
  getMessages(): BaseMessage[]
  addMessage(message: BaseMessage): void
  clear(): void
}

const sessionStore = new Map<string, BaseMessage[]>()

export async function initBufferMemory(nodeData: NodeData): Promise<FlowMemory> {
  const inputs = nodeData.inputs
  const memoryKey = (inputs.memoryKey as string) || 'chat_history'
  const sessionId = (inputs.sessionId as string) || 'default'

  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, [])
  }

  return {
    memoryKey,
    getMessages: () => sessionStore.get(sessionId) ?? [],
    addMessage: (msg: BaseMessage) => {
      const msgs = sessionStore.get(sessionId)
      if (msgs) msgs.push(msg)
    },
    clear: () => sessionStore.set(sessionId, []),
  }
}

/** Clear all session memory (for testing). */
export function clearAllSessions(): void {
  sessionStore.clear()
}
