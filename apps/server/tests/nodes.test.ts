import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { describe, expect, it } from 'vitest'
import { clearAllSessions, initBufferMemory } from '../src/services/nodes/bufferMemory.js'
import { initChatDeepseek } from '../src/services/nodes/chatDeepseek.js'
import { initConversationChain } from '../src/services/nodes/conversationChain.js'
import type { NodeData } from '../src/types/node.js'

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

  it('parses baseOptions JSON string and merges into configuration', async () => {
    const data: NodeData = {
      ...baseData,
      inputs: {
        ...baseData.inputs,
        baseOptions: JSON.stringify({ defaultHeaders: { 'X-Custom': 'test' } }),
      },
    }
    const model = await initChatDeepseek(data, { deepseekApiKey: 'sk-test' })
    expect(model).toBeInstanceOf(ChatOpenAI)
  })

  it('accepts baseOptions as object', async () => {
    const data: NodeData = {
      ...baseData,
      inputs: {
        ...baseData.inputs,
        baseOptions: { defaultHeaders: { 'X-Custom': 'test' } },
      },
    }
    const model = await initChatDeepseek(data, { deepseekApiKey: 'sk-test' })
    expect(model).toBeInstanceOf(ChatOpenAI)
  })

  it('strips baseURL from baseOptions to prevent override', async () => {
    const data: NodeData = {
      ...baseData,
      inputs: {
        ...baseData.inputs,
        baseOptions: JSON.stringify({ baseURL: 'https://evil.com', defaultHeaders: {} }),
      },
    }
    // Should not throw — baseURL is silently removed
    const model = await initChatDeepseek(data, { deepseekApiKey: 'sk-test' })
    expect(model).toBeInstanceOf(ChatOpenAI)
  })

  it('throws on invalid baseOptions JSON', async () => {
    const data: NodeData = {
      ...baseData,
      inputs: {
        ...baseData.inputs,
        baseOptions: 'not valid json',
      },
    }
    await expect(initChatDeepseek(data, { deepseekApiKey: 'sk-test' })).rejects.toThrow(
      'Invalid JSON in the BaseOptions',
    )
  })

  it('ignores empty baseOptions string', async () => {
    const data: NodeData = {
      ...baseData,
      inputs: {
        ...baseData.inputs,
        baseOptions: '',
      },
    }
    // Empty string is falsy — should be ignored
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

  it('uses chatId-derived sessionId when injected via overrideConfig', async () => {
    clearAllSessions()
    // Simulates what happens when flowRunner injects sessionId from overrideConfig
    const chatSessionId = 'chat-abc-123'
    const mem = await initBufferMemory({
      ...baseData,
      inputs: { ...baseData.inputs, sessionId: chatSessionId },
    })
    mem.addMessage(new HumanMessage('hello from chat abc'))

    // Different session should not see those messages
    const mem2 = await initBufferMemory({
      ...baseData,
      inputs: { ...baseData.inputs, sessionId: 'chat-xyz-456' },
    })
    expect(mem2.getMessages()).toHaveLength(0)

    // Same session should see them
    const mem3 = await initBufferMemory({
      ...baseData,
      inputs: { ...baseData.inputs, sessionId: chatSessionId },
    })
    expect(mem3.getMessages()).toHaveLength(1)
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

  it('invoke() returns model output as string', async () => {
    clearAllSessions()
    const mockModel = {
      invoke: async () => ({ content: 'Hello world' }),
      stream: async () => ({
        [Symbol.asyncIterator]: async function* () {
          yield { content: '' }
        },
      }),
    }
    const mem = await initBufferMemory({
      name: 'bufferMemory',
      type: 'BufferMemory',
      label: 'Buffer Memory',
      inputs: { memoryKey: 'chat_history', sessionId: 'invoke-test' },
    })
    const chain = await initConversationChain({
      name: 'conversationChain',
      type: 'ConversationChain',
      label: 'Conversation Chain',
      inputs: { model: mockModel, memory: mem },
    })

    const result = await chain.invoke('Hi')
    expect(result).toBe('Hello world')
  })

  it('invoke() saves human and AI messages to memory', async () => {
    clearAllSessions()
    const mockModel = {
      invoke: async () => ({ content: 'I am AI' }),
      stream: async () => ({
        [Symbol.asyncIterator]: async function* () {
          yield { content: '' }
        },
      }),
    }
    const mem = await initBufferMemory({
      name: 'bufferMemory',
      type: 'BufferMemory',
      label: 'Buffer Memory',
      inputs: { memoryKey: 'chat_history', sessionId: 'mem-invoke-test' },
    })
    const chain = await initConversationChain({
      name: 'conversationChain',
      type: 'ConversationChain',
      label: 'Conversation Chain',
      inputs: { model: mockModel, memory: mem },
    })

    await chain.invoke('Hello')

    const msgs = mem.getMessages()
    expect(msgs).toHaveLength(2)
    expect(msgs[0]).toBeInstanceOf(HumanMessage)
    expect(msgs[0]?.content).toBe('Hello')
    expect(msgs[1]).toBeInstanceOf(AIMessage)
    expect(msgs[1]?.content).toBe('I am AI')
  })

  it('stream() yields text chunks and saves to memory', async () => {
    clearAllSessions()
    const mockModel = {
      stream: async () => {
        async function* gen() {
          yield { content: 'chunk1' }
          yield { content: 'chunk2' }
        }
        return {
          [Symbol.asyncIterator]: gen,
        }
      },
      invoke: async () => ({ content: '' }),
    }
    const mem = await initBufferMemory({
      name: 'bufferMemory',
      type: 'BufferMemory',
      label: 'Buffer Memory',
      inputs: { memoryKey: 'chat_history', sessionId: 'stream-test' },
    })
    const chain = await initConversationChain({
      name: 'conversationChain',
      type: 'ConversationChain',
      label: 'Conversation Chain',
      inputs: { model: mockModel, memory: mem },
    })

    const stream = await chain.stream('Tell me more')
    const chunks: string[] = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(['chunk1', 'chunk2'])

    // Memory should have human + AI messages
    const msgs = mem.getMessages()
    expect(msgs).toHaveLength(2)
    expect(msgs[0]).toBeInstanceOf(HumanMessage)
    expect(msgs[0]?.content).toBe('Tell me more')
    expect(msgs[1]).toBeInstanceOf(AIMessage)
    expect(msgs[1]?.content).toBe('chunk1chunk2')
  })

  it('passes system message and history to model', async () => {
    clearAllSessions()
    let capturedMessages: unknown[] = []
    const mockModel = {
      invoke: async (msgs: unknown[]) => {
        capturedMessages = msgs
        return { content: 'response' }
      },
      stream: async () => ({
        [Symbol.asyncIterator]: async function* () {
          yield { content: '' }
        },
      }),
    }
    const mem = await initBufferMemory({
      name: 'bufferMemory',
      type: 'BufferMemory',
      label: 'Buffer Memory',
      inputs: { memoryKey: 'chat_history', sessionId: 'sysmsg-test' },
    })
    // Pre-fill memory with history
    mem.addMessage(new HumanMessage('prev question'))
    mem.addMessage(new AIMessage('prev answer'))

    const chain = await initConversationChain({
      name: 'conversationChain',
      type: 'ConversationChain',
      label: 'Conversation Chain',
      inputs: { model: mockModel, memory: mem, systemMessagePrompt: 'You are a pirate.' },
    })

    await chain.invoke('Ahoy')

    // Should be: SystemMessage, HumanMessage(prev), AIMessage(prev), HumanMessage(Ahoy)
    expect(capturedMessages).toHaveLength(4)
    expect(capturedMessages[0]).toBeInstanceOf(SystemMessage)
    expect((capturedMessages[0] as { content: string }).content).toBe('You are a pirate.')
    expect(capturedMessages[1]).toBeInstanceOf(HumanMessage)
    expect((capturedMessages[1] as { content: string }).content).toBe('prev question')
    expect(capturedMessages[2]).toBeInstanceOf(AIMessage)
    expect(capturedMessages[3]).toBeInstanceOf(HumanMessage)
    expect((capturedMessages[3] as { content: string }).content).toBe('Ahoy')
  })

  it('uses default system message when none provided', async () => {
    clearAllSessions()
    let capturedMessages: unknown[] = []
    const mockModel = {
      invoke: async (msgs: unknown[]) => {
        capturedMessages = msgs
        return { content: 'ok' }
      },
      stream: async () => ({
        [Symbol.asyncIterator]: async function* () {
          yield { content: '' }
        },
      }),
    }
    const chain = await initConversationChain({
      name: 'conversationChain',
      type: 'ConversationChain',
      label: 'Conversation Chain',
      inputs: { model: mockModel },
    })

    await chain.invoke('test')

    expect(capturedMessages[0]).toBeInstanceOf(SystemMessage)
    expect((capturedMessages[0] as { content: string }).content).toContain(
      'friendly conversation between a human and an AI',
    )
  })
})
