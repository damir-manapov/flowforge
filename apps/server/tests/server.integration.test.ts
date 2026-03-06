import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../src/server.js'
import { clearStore } from '../src/storage/inMemoryStore.js'

describe('server integration (inject)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.stubEnv('LOG_LEVEL', 'silent')
    clearStore()
    app = await buildServer()
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    clearStore()
    vi.unstubAllEnvs()
  })

  describe('ping', () => {
    it('GET /api/v1/ping returns 200 pong', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/ping' })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('pong')
    })
  })

  describe('not-found handler', () => {
    it('returns structured 404 for unknown route', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/nonexistent' })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.statusCode).toBe(404)
      expect(body.error).toBe('Not Found')
    })
  })

  describe('chatflows CRUD', () => {
    it('creates and retrieves a chatflow', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'test-flow' },
      })
      expect(create.statusCode).toBe(200)
      const chatflow = JSON.parse(create.body)
      expect(chatflow.name).toBe('test-flow')
      expect(chatflow.id).toBeDefined()

      const get = await app.inject({ method: 'GET', url: `/api/v1/chatflows/${chatflow.id}` })
      expect(get.statusCode).toBe(200)
      expect(JSON.parse(get.body).id).toBe(chatflow.id)
    })

    it('returns 400 for invalid UUID on GET', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/chatflows/bad-id' })
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for non-existent chatflow', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chatflows/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(404)
    })

    it('updates a chatflow', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'original' },
      })
      const { id } = JSON.parse(create.body)

      const update = await app.inject({
        method: 'PUT',
        url: `/api/v1/chatflows/${id}`,
        payload: { name: 'updated' },
      })
      expect(update.statusCode).toBe(200)
      expect(JSON.parse(update.body).name).toBe('updated')
    })

    it('deletes a chatflow', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'to-delete' },
      })
      const { id } = JSON.parse(create.body)

      const del = await app.inject({ method: 'DELETE', url: `/api/v1/chatflows/${id}` })
      expect(del.statusCode).toBe(200)

      const get = await app.inject({ method: 'GET', url: `/api/v1/chatflows/${id}` })
      expect(get.statusCode).toBe(404)
    })

    it('returns 400 when name is missing on POST', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('prediction', () => {
    it('returns 400 for invalid flowId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/prediction/not-a-uuid',
        payload: { question: 'Hi' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for non-existent chatflow', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/prediction/00000000-0000-0000-0000-000000000000',
        payload: { question: 'Hi' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('returns 400 when question is missing', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'pred-test' },
      })
      const { id } = JSON.parse(create.body)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/prediction/${id}`,
        payload: { streaming: false },
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns stub response for non-streaming prediction', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'pred-test' },
      })
      const { id } = JSON.parse(create.body)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/prediction/${id}`,
        payload: { question: 'Hello', streaming: false },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.text).toBe('This is a stub response from FlowForge.')
      expect(body.question).toBe('Hello')
    })

    it('returns SSE stream for streaming prediction', async () => {
      vi.stubEnv('STUB_TOKEN_DELAY_MS', '0')
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'stream-test' },
      })
      const { id } = JSON.parse(create.body)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/prediction/${id}`,
        payload: { question: 'Hello', streaming: true },
      })
      expect(res.statusCode).toBe(200)

      const lines = res.body.split('\n')
      const events = lines.filter((l: string) => l.startsWith('event: '))
      const tokenEvents = events.filter((e: string) => e === 'event: token')
      const endEvents = events.filter((e: string) => e === 'event: end')

      expect(tokenEvents.length).toBeGreaterThan(0)
      expect(endEvents).toHaveLength(1)

      // Verify end event contains valid JSON payload
      const endIdx = lines.findIndex((l: string) => l === 'event: end')
      const endDataLine = lines[endIdx + 1]
      expect(endDataLine).toBeDefined()
      const endPayload = JSON.parse(endDataLine?.replace('data: ', '') ?? '')
      expect(endPayload.question).toBe('Hello')
      expect(endPayload.chatId).toBeDefined()
    })
  })

  describe('attachments', () => {
    it('returns 400 for invalid chatflowId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attachments/bad-id/chat1',
        payload: 'test',
        headers: { 'content-type': 'multipart/form-data; boundary=---test' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 for empty chatId', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'attach-test' },
      })
      const { id } = JSON.parse(create.body)

      const boundary = '----testboundary'
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--${boundary}--\r\n`

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/attachments/${id}/%20`,
        payload: body,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
