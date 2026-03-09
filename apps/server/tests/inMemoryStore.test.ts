import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChatflow, deleteChatflow as deleteViaService, updateChatflow } from '../src/services/chatflowService.js'
import {
  clearStore,
  deleteChatflow,
  getAllChatflows,
  getChatflowById,
  oldestKey,
  setChatflow,
  storeSize,
} from '../src/storage/inMemoryStore.js'
import { makeChatflow } from './_helpers/fixtures.js'

afterEach(() => clearStore())

describe('inMemoryStore (CRUD)', () => {
  describe('setChatflow / getChatflowById', () => {
    it('stores and retrieves a chatflow', () => {
      const cf = makeChatflow({ id: 'abc' })
      setChatflow(cf)
      expect(getChatflowById('abc')).toEqual(cf)
    })

    it('returns undefined for non-existent id', () => {
      expect(getChatflowById('nope')).toBeUndefined()
    })

    it('overwrites existing entry with same id', () => {
      setChatflow(makeChatflow({ id: 'x', name: 'Old' }))
      setChatflow(makeChatflow({ id: 'x', name: 'New' }))
      expect(getChatflowById('x')?.name).toBe('New')
    })
  })

  describe('getAllChatflows', () => {
    it('returns empty array initially', () => {
      expect(getAllChatflows()).toEqual([])
    })

    it('returns all stored chatflows', () => {
      setChatflow(makeChatflow({ id: 'a' }))
      setChatflow(makeChatflow({ id: 'b' }))
      expect(getAllChatflows()).toHaveLength(2)
    })
  })

  describe('deleteChatflow', () => {
    it('returns false for non-existent id', () => {
      expect(deleteChatflow('nope')).toBe(false)
    })

    it('deletes an existing entry', () => {
      setChatflow(makeChatflow({ id: 'del' }))
      expect(deleteChatflow('del')).toBe(true)
      expect(getChatflowById('del')).toBeUndefined()
    })
  })

  describe('storeSize', () => {
    it('returns 0 for empty store', () => {
      expect(storeSize()).toBe(0)
    })

    it('reflects insertion count', () => {
      setChatflow(makeChatflow({ id: 'a' }))
      setChatflow(makeChatflow({ id: 'b' }))
      expect(storeSize()).toBe(2)
    })
  })

  describe('oldestKey', () => {
    it('returns undefined for empty store', () => {
      expect(oldestKey()).toBeUndefined()
    })

    it('returns first inserted key', () => {
      setChatflow(makeChatflow({ id: 'first' }))
      setChatflow(makeChatflow({ id: 'second' }))
      expect(oldestKey()).toBe('first')
    })
  })

  describe('clearStore', () => {
    it('removes all entries', () => {
      setChatflow(makeChatflow({ id: 'a' }))
      setChatflow(makeChatflow({ id: 'b' }))
      clearStore()
      expect(getAllChatflows()).toEqual([])
      expect(storeSize()).toBe(0)
    })
  })
})

describe('chatflowService (domain logic)', () => {
  describe('createChatflow', () => {
    it('creates a chatflow with defaults', () => {
      const cf = createChatflow({ name: 'Test' })
      expect(cf.id).toBeTypeOf('string')
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
      const updated = updateChatflow(cf.id, { name: 'Bumped' })
      expect(updated?.updatedDate).toBeTypeOf('string')
      expect(new Date(updated?.updatedDate ?? '').getTime()).toBeGreaterThanOrEqual(new Date(original).getTime())
    })
  })

  describe('deleteChatflow (via service)', () => {
    it('returns false for non-existent id', () => {
      expect(deleteViaService('nope')).toBe(false)
    })

    it('deletes an existing chatflow', () => {
      const cf = createChatflow({ name: 'Delete me' })
      expect(deleteViaService(cf.id)).toBe(true)
      expect(getChatflowById(cf.id)).toBeUndefined()
    })
  })

  describe('bounded eviction', () => {
    it('evicts the oldest entry when store is full', async () => {
      vi.stubEnv('MAX_CHATFLOWS', '3')
      vi.resetModules()
      const mod = await import('../src/services/chatflowService.js')

      const first = mod.createChatflow({ name: 'first' })
      mod.createChatflow({ name: 'second' })
      mod.createChatflow({ name: 'third' })

      const log = { warn: vi.fn() }
      const fourth = mod.createChatflow({ name: 'fourth' }, log)

      expect(mod.getChatflowById(first.id)).toBeUndefined()
      expect(mod.getChatflowById(fourth.id)?.name).toBe('fourth')
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('evicted chatflow'))
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining(first.id))

      mod.clearStore()
      vi.unstubAllEnvs()
    })
  })
})
