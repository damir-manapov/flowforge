import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ChatflowListSchema, ChatflowSchema, ErrorResponseSchema } from '../../src/schemas.js'
import { client, log, recorder, shouldRecord } from '../../src/setup.js'

describe('02 — Chatflows CRUD', () => {
  let createdId: string

  beforeAll(() => {
    log.info('Starting chatflows CRUD tests')
  })

  afterAll(async () => {
    if (createdId) {
      await client.delete(`/chatflows/${createdId}`)
    }
  })

  it('POST /chatflows creates a chatflow', async () => {
    const res = await client.post('/chatflows', {
      name: 'compat-test-flow',
      flowData: '{"nodes":[],"edges":[]}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })

    log.info('create chatflow response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ChatflowSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      createdId = parsed.data.id
      expect(parsed.data.name).toBe('compat-test-flow')

      if (shouldRecord()) {
        recorder.record('chatflows/create', body)
      }
    }
  })

  it('GET /chatflows returns a list', async () => {
    const res = await client.get('/chatflows')

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ChatflowListSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (shouldRecord()) {
      recorder.record('chatflows/list', body)
    }
  })

  it('GET /chatflows/:id returns the chatflow', async () => {
    expect(createdId).toBeDefined()

    const res = await client.get(`/chatflows/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ChatflowSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(createdId)
    }

    if (shouldRecord()) {
      recorder.record('chatflows/get', body)
    }
  })

  it('PUT /chatflows/:id updates the chatflow', async () => {
    expect(createdId).toBeDefined()

    const res = await client.put(`/chatflows/${createdId}`, {
      name: 'compat-test-flow-updated',
    })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ChatflowSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe('compat-test-flow-updated')
    }

    if (shouldRecord()) {
      recorder.record('chatflows/update', body)
    }
  })

  it('DELETE /chatflows/:id deletes the chatflow', async () => {
    expect(createdId).toBeDefined()

    const res = await client.delete(`/chatflows/${createdId}`)

    expect(res.status).toBe(200)

    createdId = ''

    if (shouldRecord()) {
      recorder.record('chatflows/delete', res.json())
    }
  })

  it('GET /chatflows/:id returns error for missing id', async () => {
    const res = await client.get('/chatflows/00000000-0000-0000-0000-000000000000')

    // Flowise returns 500, our reimpl returns 404
    expect(res.status).toBeGreaterThanOrEqual(400)

    const body = res.json()
    const parsed = ErrorResponseSchema.safeParse(body)
    expect(parsed.success).toBe(true)
  })

  it('POST /chatflows with missing name returns error', async () => {
    const res = await client.post('/chatflows', {
      flowData: '{"nodes":[],"edges":[]}',
    })

    // Flowise returns 500, our reimpl returns 400
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
