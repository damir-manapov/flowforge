import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ApiKeyListSchema, DeleteResultSchema, VariableListSchema, VariableSchema } from '../../src/schemas.js'
import { client, log } from '../../src/setup.js'

describe('04 — Variables CRUD', () => {
  let createdId: string

  beforeAll(() => {
    log.info('Starting variables CRUD tests')
  })

  afterAll(async () => {
    if (createdId) {
      await client.delete(`/variables/${createdId}`)
    }
  })

  it('POST /variables creates a variable', async () => {
    const res = await client.post('/variables', {
      name: 'COMPAT_TEST_VAR',
      value: 'test-value-123',
      type: 'static',
    })

    log.info('create variable response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = VariableSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      createdId = parsed.data.id
      expect(parsed.data.name).toBe('COMPAT_TEST_VAR')
      expect(parsed.data.value).toBe('test-value-123')
      expect(parsed.data.type).toBe('static')
    }
  })

  it('GET /variables returns a list including the created variable', async () => {
    const res = await client.get('/variables')

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = VariableListSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const found = parsed.data.find((v) => v.id === createdId)
      expect(found).toBeDefined()
      expect(found?.name).toBe('COMPAT_TEST_VAR')
      expect(found?.value).toBe('test-value-123')
    }
  })

  it('PUT /variables/:id updates a variable', async () => {
    const res = await client.put(`/variables/${createdId}`, {
      name: 'COMPAT_TEST_VAR',
      value: 'updated-value',
      type: 'runtime',
    })

    log.info('update variable response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = VariableSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.value).toBe('updated-value')
      expect(parsed.data.type).toBe('runtime')
    }
  })

  it('DELETE /variables/:id deletes a variable', async () => {
    const res = await client.delete(`/variables/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = DeleteResultSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.affected).toBe(1)
    }

    // Mark as cleaned up
    createdId = ''
  })

  it('GET /variables after delete does not include removed variable', async () => {
    const res = await client.get('/variables')

    expect(res.status).toBe(200)
    const body = res.json() as Array<{ name: string }>
    expect(body.find((v) => v.name === 'COMPAT_TEST_VAR')).toBeUndefined()
  })
})

describe('04 — API Keys CRUD', () => {
  let createdKeyId: string

  beforeAll(() => {
    log.info('Starting API keys CRUD tests')
  })

  afterAll(async () => {
    if (createdKeyId) {
      await client.delete(`/apikey/${createdKeyId}`)
    }
  })

  it('POST /apikey creates a key and returns full array', async () => {
    const res = await client.post('/apikey', {
      keyName: 'compat-test-key',
    })

    log.info('create apikey response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ApiKeyListSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBeGreaterThanOrEqual(1)

      const created = parsed.data.find((k) => k.keyName === 'compat-test-key')
      expect(created).toBeDefined()

      if (created) {
        createdKeyId = created.id
        expect(created.apiKey).toBeTruthy()
        expect(created.apiKey.length).toBeGreaterThan(20)
        expect(created.apiSecret).toBeTruthy()
        expect(created.apiSecret).toContain('.') // hash.salt format
      }
    }
  })

  it('GET /apikey returns the full array', async () => {
    const res = await client.get('/apikey')

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ApiKeyListSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const found = parsed.data.find((k) => k.id === createdKeyId)
      expect(found).toBeDefined()
      expect(found?.keyName).toBe('compat-test-key')
    }
  })

  it('DELETE /apikey/:id returns remaining keys without deleted', async () => {
    const res = await client.delete(`/apikey/${createdKeyId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ApiKeyListSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const found = parsed.data.find((k) => k.id === createdKeyId)
      expect(found).toBeUndefined()
    }

    // Mark as cleaned up
    createdKeyId = ''
  })
})
