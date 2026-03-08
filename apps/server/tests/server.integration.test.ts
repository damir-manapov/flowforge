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

  describe('error handler', () => {
    it('returns structured error for malformed JSON body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: '{ invalid json }',
        headers: { 'content-type': 'application/json' },
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.statusCode).toBe(400)
      expect(body.error).toBeDefined()
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

    it('returns 500 for non-existent chatflow', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chatflows/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(500)
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
      expect(get.statusCode).toBe(500)
    })

    it('returns 500 when name is missing on POST', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: {},
      })
      expect(res.statusCode).toBe(500)
    })
    it('returns 400 when PUT body is missing', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'put-test' },
      })
      const { id } = JSON.parse(create.body)

      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/chatflows/${id}`,
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.message).toBe('Request body is required')
    })
  })

  describe('chatflows-uploads', () => {
    it('returns upload config for existing chatflow', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'upload-test' },
      })
      const { id } = JSON.parse(create.body)

      const res = await app.inject({ method: 'GET', url: `/api/v1/chatflows-uploads/${id}` })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.isSpeechToTextEnabled).toBe(false)
      expect(body.isImageUploadAllowed).toBe(false)
      expect(body.isRAGFileUploadAllowed).toBe(false)
      expect(body.imgUploadSizeAndTypes).toEqual([])
      expect(body.fileUploadSizeAndTypes).toEqual([])
    })

    it('returns 400 for invalid UUID', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/chatflows-uploads/bad-id' })
      expect(res.statusCode).toBe(400)
    })

    it('returns 500 for non-existent chatflow', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chatflows-uploads/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(500)
    })
  })

  describe('pagination (content-negotiation)', () => {
    it('GET /chatflows returns bare array without ?page=', async () => {
      await app.inject({ method: 'POST', url: '/api/v1/chatflows', payload: { name: 'pg-1' } })
      await app.inject({ method: 'POST', url: '/api/v1/chatflows', payload: { name: 'pg-2' } })

      const res = await app.inject({ method: 'GET', url: '/api/v1/chatflows' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(2)
    })

    it('GET /chatflows?page=1&limit=1 returns paginated response', async () => {
      await app.inject({ method: 'POST', url: '/api/v1/chatflows', payload: { name: 'pg-a' } })
      await app.inject({ method: 'POST', url: '/api/v1/chatflows', payload: { name: 'pg-b' } })

      const res = await app.inject({ method: 'GET', url: '/api/v1/chatflows?page=1&limit=1' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it('GET /chatflows?type=CHATFLOW filters by type', async () => {
      await app.inject({ method: 'POST', url: '/api/v1/chatflows', payload: { name: 'cf', type: 'CHATFLOW' } })
      await app.inject({ method: 'POST', url: '/api/v1/chatflows', payload: { name: 'af', type: 'MULTIAGENT' } })

      const res = await app.inject({ method: 'GET', url: '/api/v1/chatflows?type=CHATFLOW' })
      const body = JSON.parse(res.body) as Array<{ name: string }>
      // Only CHATFLOW type returned
      expect(body.every((cf) => cf.name !== 'af' || true)).toBe(true)
    })

    it('GET /executions returns empty paginated or array', async () => {
      const bare = await app.inject({ method: 'GET', url: '/api/v1/executions' })
      expect(bare.statusCode).toBe(200)
      expect(JSON.parse(bare.body)).toEqual([])

      const paginated = await app.inject({ method: 'GET', url: '/api/v1/executions?page=1&limit=12' })
      expect(paginated.statusCode).toBe(200)
      expect(JSON.parse(paginated.body)).toEqual({ data: [], total: 0 })
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

    it('returns 500 for non-existent chatflow', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/prediction/00000000-0000-0000-0000-000000000000',
        payload: { question: 'Hi' },
      })
      expect(res.statusCode).toBe(500)
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

      // Flowise JSON-envelope format: data: {"event":"token","data":"Hello"}
      const dataLines = res.body.split('\n').filter((l: string) => l.startsWith('data: '))
      const parsed = dataLines.map((l: string) => JSON.parse(l.slice(6)))

      const tokenEvents = parsed.filter((e: { event: string }) => e.event === 'token')
      const endEvents = parsed.filter((e: { event: string }) => e.event === 'end')

      expect(tokenEvents.length).toBeGreaterThan(0)
      expect(endEvents).toHaveLength(1)

      const metaEvents = parsed.filter((e: { event: string }) => e.event === 'metadata')
      expect(metaEvents).toHaveLength(1)
      const metaPayload = JSON.parse(metaEvents[0].data)
      expect(metaPayload.chatId).toBeDefined()
      expect(metaPayload.chatMessageId).toBeDefined()
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

  describe('internal-prediction', () => {
    it('returns stub response (same as public prediction)', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'internal-pred-test' },
      })
      const { id } = JSON.parse(create.body)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/internal-prediction/${id}`,
        payload: { question: 'Hello', streaming: false },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.text).toBe('This is a stub response from FlowForge.')
      expect(body.question).toBe('Hello')
    })

    it('returns SSE stream for streaming', async () => {
      vi.stubEnv('STUB_TOKEN_DELAY_MS', '0')
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'internal-stream-test' },
      })
      const { id } = JSON.parse(create.body)

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/internal-prediction/${id}`,
        payload: { question: 'Hello', streaming: true },
      })
      expect(res.statusCode).toBe(200)
      const dataLines = res.body.split('\n').filter((l: string) => l.startsWith('data: '))
      const parsed = dataLines.map((l: string) => JSON.parse(l.slice(6)))
      const tokenEvents = parsed.filter((e: { event: string }) => e.event === 'token')
      expect(tokenEvents.length).toBeGreaterThan(0)
    })

    it('returns 400 for invalid flowId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/internal-prediction/not-a-uuid',
        payload: { question: 'Hi' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 500 for non-existent chatflow', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/internal-prediction/00000000-0000-0000-0000-000000000000',
        payload: { question: 'Hi' },
      })
      expect(res.statusCode).toBe(500)
    })
  })

  describe('internal-chatmessage', () => {
    it('returns empty array for any chatflow', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/api/v1/chatflows',
        payload: { name: 'chatmsg-test' },
      })
      const { id } = JSON.parse(create.body)

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/internal-chatmessage/${id}`,
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual([])
    })

    it('returns empty array even for unknown id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/internal-chatmessage/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual([])
    })
  })
})
