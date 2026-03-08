import { describe, expect, it } from 'vitest'
import { generateStubResponse, getStubTokenDelayMs, getStubTokens } from '../src/services/predictionService.js'
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
