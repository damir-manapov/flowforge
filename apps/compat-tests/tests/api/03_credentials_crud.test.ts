import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  CredentialListSchema,
  CredentialSchema,
  CredentialTypeListSchema,
  CredentialTypeSchema,
  CredentialWithPlainDataSchema,
  DeleteResultSchema,
} from '../../src/schemas.js'
import { client, log, testConfig } from '../../src/setup.js'

const REDACTED = '_FLOWISE_BLANK_07167752-1a71-43b1-bf8f-4f32252165db'
const isReimpl = testConfig.targetName === 'reimpl'

describe('03 — Credentials CRUD', () => {
  let createdId: string

  beforeAll(() => {
    log.info('Starting credentials CRUD tests')
  })

  afterAll(async () => {
    if (createdId) {
      await client.delete(`/credentials/${createdId}`)
    }
  })

  it('POST /credentials creates a credential', async () => {
    const res = await client.post('/credentials', {
      name: 'compat-test-cred',
      credentialName: 'openAIApi',
      plainDataObj: { openAIApiKey: 'sk-test-compat-12345' },
    })

    log.info('create credential response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = CredentialSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      createdId = parsed.data.id
      expect(parsed.data.name).toBe('compat-test-cred')
      expect(parsed.data.credentialName).toBe('openAIApi')
      expect(parsed.data.encryptedData).toBeTruthy()
      // encryptedData should NOT contain the plaintext key
      expect(parsed.data.encryptedData).not.toContain('sk-test-compat-12345')
    }
  })

  it('GET /credentials returns a list without encryptedData', async () => {
    const res = await client.get('/credentials')

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = CredentialListSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const found = parsed.data.find((c) => c.id === createdId)
      expect(found).toBeDefined()
      expect(found?.name).toBe('compat-test-cred')
      // List should NOT have encryptedData
      expect((found as Record<string, unknown>).encryptedData).toBeUndefined()
    }
  })

  it('GET /credentials/:id returns decrypted+redacted data', async () => {
    const res = await client.get(`/credentials/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = CredentialWithPlainDataSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe('compat-test-cred')
      expect(parsed.data.plainDataObj).toBeDefined()
      // Password field should be redacted
      expect(parsed.data.plainDataObj.openAIApiKey).toBe(REDACTED)
      // Should NOT have encryptedData
      expect((parsed.data as Record<string, unknown>).encryptedData).toBeUndefined()
    }
  })

  it('PUT /credentials/:id updates a credential', async () => {
    const res = await client.put(`/credentials/${createdId}`, {
      name: 'updated-cred',
      credentialName: 'openAIApi',
      plainDataObj: { openAIApiKey: 'sk-updated-67890' },
    })

    log.info('update credential response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = CredentialSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe('updated-cred')
      expect(parsed.data.encryptedData).toBeTruthy()
      expect(parsed.data.encryptedData).not.toContain('sk-updated-67890')
    }
  })

  it('GET /credentials/:id after update shows new name', async () => {
    const res = await client.get(`/credentials/${createdId}`)

    expect(res.status).toBe(200)
    const body = res.json() as { name: string; plainDataObj: { openAIApiKey: string } }
    expect(body.name).toBe('updated-cred')
    // Password still redacted after update
    expect(body.plainDataObj.openAIApiKey).toBe(REDACTED)
  })

  it('DELETE /credentials/:id deletes a credential', async () => {
    const res = await client.delete(`/credentials/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()

    if (isReimpl) {
      // Our reimpl returns { raw: [], affected: 1 } to match Flowise
      const parsed = DeleteResultSchema.safeParse(body)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.affected).toBe(1)
      }
    } else {
      // Flowise also returns DeleteResult
      const parsed = DeleteResultSchema.safeParse(body)
      expect(parsed.success).toBe(true)
    }

    // Mark as cleaned up
    createdId = ''
  })

  it('GET /credentials after delete returns empty or without deleted', async () => {
    const res = await client.get('/credentials')

    expect(res.status).toBe(200)
    const body = res.json() as Array<{ id: string; name: string }>
    // The deleted credential should not appear
    expect(body.find((c) => c.name === 'updated-cred')).toBeUndefined()
  })
})

describe('03 — Components-Credentials Catalog', () => {
  it('GET /components-credentials returns an array of credential types', async () => {
    const res = await client.get('/components-credentials')

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = CredentialTypeListSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBeGreaterThan(10)
      log.info('components-credentials count', { count: parsed.data.length })
    }
  })

  it('GET /components-credentials has openAIApi type', async () => {
    const res = await client.get('/components-credentials')

    expect(res.status).toBe(200)
    const body = res.json() as Array<{ name: string }>
    const openai = body.find((c) => c.name === 'openAIApi')
    expect(openai).toBeDefined()
  })

  it('GET /components-credentials/:name returns a single type', async () => {
    const res = await client.get('/components-credentials/openAIApi')

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = CredentialTypeSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe('openAIApi')
      expect(parsed.data.label).toBe('OpenAI API')
      expect(parsed.data.inputs).toBeDefined()
      expect(parsed.data.inputs?.some((i) => i.name === 'openAIApiKey')).toBe(true)
    }
  })
})
