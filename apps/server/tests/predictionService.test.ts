import { describe, expect, it } from 'vitest'
import {
  allNodesSupported,
  generateStubResponse,
  getStubTokenDelayMs,
  getStubTokens,
} from '../src/services/predictionService.js'
import { UUID_RE } from './_helpers/fixtures.js'

describe('predictionService', () => {
  describe('generateStubResponse', () => {
    it('returns a PredictionResult with the question echoed', () => {
      const result = generateStubResponse('What is AI?')
      expect(result.question).toBe('What is AI?')
      expect(result.text).toBe('This is a stub response from FlowForge.')
    })

    it('has valid UUID fields', () => {
      const result = generateStubResponse('Hi')
      expect(result.chatId).toMatch(UUID_RE)
      expect(result.chatMessageId).toMatch(UUID_RE)
      expect(result.sessionId).toMatch(UUID_RE)
    })

    it('generates unique IDs per call', () => {
      const a = generateStubResponse('A')
      const b = generateStubResponse('B')
      expect(a.chatId).not.toBe(b.chatId)
      expect(a.chatMessageId).not.toBe(b.chatMessageId)
    })

    it('returns empty arrays for collection fields', () => {
      const result = generateStubResponse('test')
      expect(result.sourceDocuments).toEqual([])
      expect(result.usedTools).toEqual([])
      expect(result.fileAnnotations).toEqual([])
      expect(result.agentReasoning).toEqual([])
    })

    it('returns null memoryType', () => {
      const result = generateStubResponse('test')
      expect(result.memoryType).toBeNull()
    })
  })

  describe('getStubTokens', () => {
    it('returns an array of string tokens', () => {
      const tokens = getStubTokens()
      expect(tokens.length).toBe(7)
      for (const t of tokens) {
        expect(t).toBeTypeOf('string')
      }
    })

    it('tokens join to the full stub text', () => {
      const tokens = getStubTokens()
      expect(tokens.join('')).toBe('This is a stub response from FlowForge.')
    })
  })

  describe('getStubTokenDelayMs', () => {
    it('returns a positive number', () => {
      expect(getStubTokenDelayMs()).toBeGreaterThan(0)
    })
  })

  describe('allNodesSupported', () => {
    it('returns true when all node types are registered', () => {
      const flowData = JSON.stringify({
        nodes: [
          { data: { name: 'chatDeepseek' } },
          { data: { name: 'bufferMemory' } },
          { data: { name: 'conversationChain' } },
        ],
      })
      expect(allNodesSupported(flowData)).toBe(true)
    })

    it('returns false when a node type is not registered', () => {
      const flowData = JSON.stringify({
        nodes: [{ data: { name: 'chatDeepseek' } }, { data: { name: 'unknownNode' } }],
      })
      expect(allNodesSupported(flowData)).toBe(false)
    })

    it('returns false for empty nodes', () => {
      expect(allNodesSupported(JSON.stringify({ nodes: [] }))).toBe(false)
    })

    it('returns false for invalid JSON', () => {
      expect(allNodesSupported('not-json')).toBe(false)
    })

    it('returns false when nodes have no name', () => {
      const flowData = JSON.stringify({ nodes: [{ data: {} }] })
      expect(allNodesSupported(flowData)).toBe(false)
    })
  })
})
