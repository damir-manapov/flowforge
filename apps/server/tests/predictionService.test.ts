import { describe, expect, it } from 'vitest'
import { generateStubResponse, getStubTokenDelayMs, getStubTokens } from '../src/services/predictionService.js'

describe('predictionService', () => {
  describe('generateStubResponse', () => {
    it('returns a PredictionResult with the question echoed', () => {
      const result = generateStubResponse('What is AI?')
      expect(result.question).toBe('What is AI?')
      expect(result.text).toBe('This is a stub response from FlowForge.')
    })

    it('has valid UUID fields', () => {
      const result = generateStubResponse('Hi')
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(result.chatId).toMatch(uuidRe)
      expect(result.chatMessageId).toMatch(uuidRe)
      expect(result.sessionId).toMatch(uuidRe)
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
      expect(tokens.length).toBeGreaterThan(0)
      for (const t of tokens) {
        expect(typeof t).toBe('string')
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
})
