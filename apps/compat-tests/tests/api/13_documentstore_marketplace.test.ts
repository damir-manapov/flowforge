import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DocumentStoreCreatedSchema,
  DocumentStoreDeleteResultSchema,
  DocumentStoreDetailSchema,
  DocumentStoreListSchema,
  MarketplaceTemplateListSchema,
  MarketplaceTemplateSchema,
} from '../../src/schemas.js'
import { client, log } from '../../src/setup.js'

// ── Document Store CRUD ──────────────────────────────────────────────

describe('13 — Document Store CRUD', () => {
  let createdId: string

  beforeAll(() => {
    log.info('Starting document store CRUD tests')
  })

  afterAll(async () => {
    if (createdId) {
      await client.delete(`/document-store/store/${createdId}`)
    }
  })

  it('POST /document-store/store creates a document store', async () => {
    const res = await client.post('/document-store/store', {
      name: 'compat-test-store',
      description: 'A test document store for compat testing',
    })

    log.info('create document store response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = DocumentStoreCreatedSchema.parse(body)

    createdId = parsed.id
    expect(parsed.name).toBe('compat-test-store')
    expect(parsed.description).toBe('A test document store for compat testing')
    expect(parsed.loaders).toBe('[]')
    expect(parsed.whereUsed).toBe('[]')
    expect(parsed.status).toBe('EMPTY')
  })

  it('GET /document-store/store returns a list including the created store', async () => {
    const res = await client.get('/document-store/store')

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = DocumentStoreListSchema.parse(body)

    const found = parsed.find((s) => s.id === createdId)
    expect(found).toBeDefined()
    expect(found?.name).toBe('compat-test-store')
    // List returns parsed arrays
    expect(Array.isArray(found?.loaders)).toBe(true)
    expect(Array.isArray(found?.whereUsed)).toBe(true)
  })

  it('GET /document-store/store/:id returns the store with totals', async () => {
    const res = await client.get(`/document-store/store/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = DocumentStoreDetailSchema.parse(body)

    expect(parsed.name).toBe('compat-test-store')
    expect(Array.isArray(parsed.loaders)).toBe(true)
    expect(Array.isArray(parsed.whereUsed)).toBe(true)
    expect(parsed.totalChars).toBeTypeOf('number')
    expect(parsed.totalChunks).toBeTypeOf('number')
  })

  it('PUT /document-store/store/:id updates the store', async () => {
    const res = await client.put(`/document-store/store/${createdId}`, {
      name: 'compat-test-store-updated',
      description: 'Updated description',
    })

    expect(res.status).toBe(200)

    const body = res.json()
    // Update returns the detail shape (parsed arrays + totals)
    const parsed = DocumentStoreDetailSchema.parse(body)

    expect(parsed.name).toBe('compat-test-store-updated')
    expect(parsed.description).toBe('Updated description')
  })

  it('DELETE /document-store/store/:id deletes the store', async () => {
    const res = await client.delete(`/document-store/store/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = DocumentStoreDeleteResultSchema.parse(body)
    expect(parsed.deleted).toBe(1)

    // Clear the id so afterAll won't attempt double-delete
    createdId = ''
  })
})

// ── Marketplace Templates ────────────────────────────────────────────

describe('13 — Marketplace Templates', () => {
  it('GET /marketplaces/templates returns an array', async () => {
    const res = await client.get('/marketplaces/templates')

    expect(res.status).toBe(200)

    const body = res.json() as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)

    MarketplaceTemplateListSchema.parse(body)
  })

  it('each marketplace template has the correct shape', async () => {
    const res = await client.get('/marketplaces/templates')
    const body = res.json() as unknown[]

    // Validate first template in detail
    const first = body[0]
    const parsed = MarketplaceTemplateSchema.parse(first)

    expect(parsed.id).toBeTypeOf('string')
    expect(parsed.templateName).toBeTypeOf('string')
    if (parsed.flowData !== undefined) {
      expect(parsed.flowData).toBeTypeOf('string')
    }
  })
})
