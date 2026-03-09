import { describe, expect, it } from 'vitest'
import { getExecutableNodes, hasNodeInit, initNode } from '../src/services/nodesPool.js'

describe('nodesPool', () => {
  it('has chatDeepseek registered', () => {
    expect(hasNodeInit('chatDeepseek')).toBe(true)
  })

  it('has bufferMemory registered', () => {
    expect(hasNodeInit('bufferMemory')).toBe(true)
  })

  it('has conversationChain registered', () => {
    expect(hasNodeInit('conversationChain')).toBe(true)
  })

  it('returns false for unregistered nodes', () => {
    expect(hasNodeInit('doesNotExist')).toBe(false)
  })

  it('getExecutableNodes returns at least the 3 core types', () => {
    const names = getExecutableNodes()
    expect(names).toContain('chatDeepseek')
    expect(names).toContain('bufferMemory')
    expect(names).toContain('conversationChain')
  })

  it('initNode throws for unknown type', async () => {
    await expect(
      initNode('unknownNode', {
        name: 'unknownNode',
        type: 'unknownNode',
        label: 'Unknown',
        inputs: {},
      }),
    ).rejects.toThrow('Unknown node type: unknownNode')
  })

  it('initNode chatDeepseek throws when credential data is missing', async () => {
    await expect(
      initNode('chatDeepseek', {
        name: 'chatDeepseek',
        type: 'chatDeepseek',
        label: 'ChatDeepseek',
        inputs: { modelName: 'deepseek-chat', streaming: true },
      }),
    ).rejects.toThrow('missing deepseekApiKey')
  })

  it('initNode chatDeepseek returns a ChatOpenAI instance when credential is provided', async () => {
    const instance = await initNode(
      'chatDeepseek',
      {
        name: 'chatDeepseek',
        type: 'chatDeepseek',
        label: 'ChatDeepseek',
        inputs: { modelName: 'deepseek-chat', streaming: true },
      },
      { deepseekApiKey: 'test-key-123' },
    )

    // ChatOpenAI is an object with known properties
    expect(instance).toHaveProperty('model', 'deepseek-chat')
  })

  it('initNode bufferMemory returns a FlowMemory object', async () => {
    const instance = await initNode('bufferMemory', {
      name: 'bufferMemory',
      type: 'BufferMemory',
      label: 'Buffer Memory',
      inputs: { memoryKey: 'chat_history', sessionId: '' },
    })

    expect(instance).toHaveProperty('memoryKey', 'chat_history')
    expect(instance).toHaveProperty('getMessages')
    expect(instance).toHaveProperty('addMessage')
    expect(instance).toHaveProperty('clear')
  })
})
