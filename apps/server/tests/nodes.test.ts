import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { describe, expect, it } from 'vitest'
import type { NodeData } from '../src/services/nodeRegistry.js'
import { clearAllSessions, initBufferMemory } from '../src/services/nodes/bufferMemory.js'
import { initChatDeepseek } from '../src/services/nodes/chatDeepseek.js'
import { initConversationChain } from '../src/services/nodes/conversationChain.js'

// ── ChatDeepseek ─────────────────────────────────────────────────────

describe('chatDeepseek', () => {
  const baseData: NodeData = {
    name: 'chatDeepseek',
    type: 'chatDeepseek',
    label: 'ChatDeepseek',
    inputs: {
      modelName: 'deepseek-chat',
      temperature: 0.7,
      streaming: true,
    },
  }

  it('creates a ChatOpenAI instance with Deepseek config', async () => {
    const model = await initChatDeepseek(baseData, { deepseekApiKey: 'sk-test' })
    expect(model).toBeInstanceOf(ChatOpenAI)
    expect(model.model).toBe('deepseek-chat')
    expect(model.temperature).toBe(0.7)
  })

  it('throws when credential data is missing', async () => {
    await expect(initChatDeepseek(baseData)).rejects.toThrow('missing deepseekApiKey')
  })

  it('applies optional parameters', async () => {
    const data: NodeData = {
      ...baseData,
      inputs: {
        ...baseData.inputs,
        maxTokens: 100,
        topP: 0.9,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
      },
    }
    const model = await initChatDeepseek(data, { deepseekApiKey: 'sk-test' })
    expect(model.maxTokens).toBe(100)
  })

  it('uses custom baseURL if provided', async () => {
    const data: NodeData = {
      ...baseData,
      baseURL: 'https://custom.api.com',
    }
    const model = await initChatDeepseek(data, { deepseekApiKey: 'sk-test' })
    expect(model).toBeInstanceOf(ChatOpenAI)
  })
})

// ── BufferMemory ─────────────────────────────────────────────────────

describe('bufferMemory', () => {
  const baseData: NodeData = {
    name: 'bufferMemory',
    type: 'BufferMemory',
    label: 'Buffer Memory',
    inputs: { memoryKey: 'chat_history', sessionId: 'test-session' },
  }

  it('creates a FlowMemory with getMessages/addMessage/clear', async () => {
    clearAllSessions()
    const mem = await initBufferMemory(baseData)
    expect(mem.memoryKey).toBe('chat_history')
    expect(mem.getMessages()).toEqual([])
  })

  it('stores and retrieves messages', async () => {
    clearAllSessions()
    const mem = await initBufferMemory(baseData)
    mem.addMessage(new HumanMessage('Hello'))
    mem.addMessage(new AIMessage('Hi there!'))
    expect(mem.getMessages()).toHaveLength(2)
    expect(mem.getMessages()[0]).toBeInstanceOf(HumanMessage)
    expect(mem.getMessages()[1]).toBeInstanceOf(AIMessage)
  })

  it('clears messages', async () => {
    clearAllSessions()
    const mem = await initBufferMemory(baseData)
    mem.addMessage(new HumanMessage('Hello'))
    expect(mem.getMessages()).toHaveLength(1)
    mem.clear()
    expect(mem.getMessages()).toEqual([])
  })

  it('uses default values when inputs are empty', async () => {
    clearAllSessions()
    const mem = await initBufferMemory({
      ...baseData,
      inputs: {},
    })
    expect(mem.memoryKey).toBe('chat_history')
  })

  it('uses shared session store', async () => {
    clearAllSessions()
    const mem1 = await initBufferMemory(baseData)
    mem1.addMessage(new HumanMessage('msg1'))

    // Same session ID should share messages
    const mem2 = await initBufferMemory(baseData)
    expect(mem2.getMessages()).toHaveLength(1)
  })

  it('isolates different sessions', async () => {
    clearAllSessions()
    const mem1 = await initBufferMemory(baseData)
    mem1.addMessage(new HumanMessage('msg1'))

    const mem2 = await initBufferMemory({
      ...baseData,
      inputs: { ...baseData.inputs, sessionId: 'other-session' },
    })
    expect(mem2.getMessages()).toHaveLength(0)
  })
})

// ── ConversationChain ────────────────────────────────────────────────

describe('conversationChain', () => {
  it('throws when model input is missing', async () => {
    await expect(
      initConversationChain({
        name: 'conversationChain',
        type: 'ConversationChain',
        label: 'Conversation Chain',
        inputs: {},
      }),
    ).rejects.toThrow('missing model input')
  })

  it('creates a FlowChain with stream and invoke methods', async () => {
    clearAllSessions()

    // Create a mock model with stream and invoke
    const mockModel = {
      stream: async () => {
        async function* gen() {
          yield { content: 'Hello ' }
          yield { content: 'world' }
        }
        // Create async iterable
        return {
          [Symbol.asyncIterator]: gen,
        }
      },
      invoke: async () => ({ content: 'Hello world' }),
    }

    const mem = await initBufferMemory({
      name: 'bufferMemory',
      type: 'BufferMemory',
      label: 'Buffer Memory',
      inputs: { memoryKey: 'chat_history', sessionId: 'chain-test' },
    })

    const chain = await initConversationChain({
      name: 'conversationChain',
      type: 'ConversationChain',
      label: 'Conversation Chain',
      inputs: {
        model: mockModel,
        memory: mem,
        systemMessagePrompt: 'You are a test bot.',
      },
    })

    expect(chain).toHaveProperty('stream')
    expect(chain).toHaveProperty('invoke')
  })

  it('works without memory (memory is optional)', async () => {
    const mockModel = {
      stream: async () => ({
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'ok' }
        },
      }),
      invoke: async () => ({ content: 'ok' }),
    }

    // Should not throw
    const chain = await initConversationChain({
      name: 'conversationChain',
      type: 'ConversationChain',
      label: 'Conversation Chain',
      inputs: { model: mockModel },
    })

    expect(chain).toHaveProperty('invoke')
  })
})
