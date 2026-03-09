import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ChatflowListSchema, ChatflowSchema, DeleteResultSchema, ErrorResponseSchema } from '../../src/schemas.js'
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
    const parsed = ChatflowSchema.parse(body)

    createdId = parsed.id
    expect(parsed.name).toBe('compat-test-flow')

    if (shouldRecord()) {
      recorder.record('chatflows/create', body)
    }
  })

  it('GET /chatflows returns a list', async () => {
    const res = await client.get('/chatflows')

    expect(res.status).toBe(200)

    const body = res.json()
    ChatflowListSchema.parse(body)

    if (shouldRecord()) {
      recorder.record('chatflows/list', body)
    }
  })

  it('GET /chatflows/:id returns the chatflow', async () => {
    expect(createdId).toBeDefined()

    const res = await client.get(`/chatflows/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ChatflowSchema.parse(body)
    expect(parsed.id).toBe(createdId)

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
    const parsed = ChatflowSchema.parse(body)
    expect(parsed.name).toBe('compat-test-flow-updated')

    if (shouldRecord()) {
      recorder.record('chatflows/update', body)
    }
  })

  it('GET /chatflows-streaming/:id returns streaming status', async () => {
    expect(createdId).toBeDefined()

    const res = await client.get(`/chatflows-streaming/${createdId}`)

    // Both Flowise and our reimpl return 500 for chatflows with no ending nodes
    // (empty flowData has no ending nodes to check for streaming)
    expect(res.status).toBe(500)

    if (shouldRecord()) {
      recorder.record('chatflows/streaming', res.json())
    }
  })

  it('GET /chatflows-streaming/:id returns error for missing id', async () => {
    const res = await client.get('/chatflows-streaming/00000000-0000-0000-0000-000000000000')

    // Flowise 3.0 returns 500 for non-existent streaming chatflow
    expect(res.status).toBe(500)
  })

  it('DELETE /chatflows/:id deletes the chatflow', async () => {
    expect(createdId).toBeDefined()

    const res = await client.delete(`/chatflows/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    DeleteResultSchema.parse(body)

    createdId = ''

    if (shouldRecord()) {
      recorder.record('chatflows/delete', res.json())
    }
  })

  it('GET /chatflows/:id returns error for missing id', async () => {
    const res = await client.get('/chatflows/00000000-0000-0000-0000-000000000000')

    expect(res.status).toBe(404)

    const body = res.json()
    ErrorResponseSchema.parse(body)
  })

  it('POST /chatflows with missing name returns error', async () => {
    const res = await client.post('/chatflows', {
      flowData: '{"nodes":[],"edges":[]}',
    })

    expect(res.status).toBe(400)
  })
})
