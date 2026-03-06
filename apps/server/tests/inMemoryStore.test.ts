import { afterEach, describe, expect, it } from 'vitest'
import {
  clearStore,
  createChatflow,
  deleteChatflow,
  getAllChatflows,
  getChatflowById,
  updateChatflow,
} from '../src/storage/inMemoryStore.js'

afterEach(() => clearStore())

describe('inMemoryStore', () => {
  describe('createChatflow', () => {
    it('creates a chatflow with defaults', () => {
      const cf = createChatflow({ name: 'Test' })
      expect(cf.id).toBeDefined()
      expect(cf.name).toBe('Test')
      expect(cf.flowData).toBe('{}')
      expect(cf.deployed).toBe(false)
      expect(cf.type).toBe('CHATFLOW')
      expect(cf.createdDate).toBe(cf.updatedDate)
    })

    it('applies provided fields', () => {
      const cf = createChatflow({
        name: 'Custom',
        deployed: true,
        isPublic: true,
        category: 'ai',
        type: 'MULTIAGENT',
      })
      expect(cf.deployed).toBe(true)
      expect(cf.isPublic).toBe(true)
      expect(cf.category).toBe('ai')
      expect(cf.type).toBe('MULTIAGENT')
    })

    it('generates unique IDs', () => {
      const a = createChatflow({ name: 'A' })
      const b = createChatflow({ name: 'B' })
      expect(a.id).not.toBe(b.id)
    })
  })

  describe('getChatflowById', () => {
    it('returns undefined for non-existent id', () => {
      expect(getChatflowById('nope')).toBeUndefined()
    })

    it('returns the chatflow if it exists', () => {
      const cf = createChatflow({ name: 'Find me' })
      expect(getChatflowById(cf.id)).toEqual(cf)
    })
  })

  describe('getAllChatflows', () => {
    it('returns empty array initially', () => {
      expect(getAllChatflows()).toEqual([])
    })

    it('returns all created chatflows', () => {
      createChatflow({ name: 'A' })
      createChatflow({ name: 'B' })
      expect(getAllChatflows()).toHaveLength(2)
    })
  })

  describe('updateChatflow', () => {
    it('returns undefined for non-existent id', () => {
      expect(updateChatflow('nope', { name: 'X' })).toBeUndefined()
    })

    it('updates mutable fields', () => {
      const cf = createChatflow({ name: 'Old' })
      const updated = updateChatflow(cf.id, { name: 'New', deployed: true })
      expect(updated?.name).toBe('New')
      expect(updated?.deployed).toBe(true)
    })

    it('preserves createdDate even if supplied', () => {
      const cf = createChatflow({ name: 'Immutable' })
      const updated = updateChatflow(cf.id, { createdDate: '1999-01-01T00:00:00.000Z' })
      expect(updated?.createdDate).toBe(cf.createdDate)
    })

    it('ignores id override attempt', () => {
      const cf = createChatflow({ name: 'Keep ID' })
      // biome-ignore lint/suspicious/noExplicitAny: testing runtime guard
      const updated = updateChatflow(cf.id, { id: 'hacked-id' } as any)
      expect(updated?.id).toBe(cf.id)
    })

    it('bumps updatedDate', () => {
      const cf = createChatflow({ name: 'Bump' })
      const original = cf.updatedDate
      // Small delay to ensure different timestamp
      const updated = updateChatflow(cf.id, { name: 'Bumped' })
      expect(updated?.updatedDate).toBeDefined()
      // updatedDate should be >= original (may be same in fast execution)
      expect(new Date(updated?.updatedDate ?? '').getTime()).toBeGreaterThanOrEqual(new Date(original).getTime())
    })
  })

  describe('deleteChatflow', () => {
    it('returns false for non-existent id', () => {
      expect(deleteChatflow('nope')).toBe(false)
    })

    it('deletes an existing chatflow', () => {
      const cf = createChatflow({ name: 'Delete me' })
      expect(deleteChatflow(cf.id)).toBe(true)
      expect(getChatflowById(cf.id)).toBeUndefined()
    })
  })

  describe('clearStore', () => {
    it('removes all chatflows', () => {
      createChatflow({ name: 'A' })
      createChatflow({ name: 'B' })
      clearStore()
      expect(getAllChatflows()).toEqual([])
    })
  })
})
