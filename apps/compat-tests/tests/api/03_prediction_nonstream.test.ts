import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { client, shouldRecord, recorder, log } from '../../src/setup.js'
import { PredictionResponseSchema } from '../../src/schemas.js'

describe('03 — Prediction (non-streaming)', () => {
  let chatflowId: string

  beforeAll(async () => {
    const res = await client.post('/chatflows', {
      name: 'prediction-test-flow',
      flowData: '{"nodes":[],"edges":[]}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const body = res.json<{ id: string }>()
    chatflowId = body.id
    log.info('created test chatflow', { chatflowId })
  })

  afterAll(async () => {
    if (chatflowId) {
      await client.delete(`/chatflows/${chatflowId}`)
    }
  })

  it('POST /prediction/:flowId returns a response', async () => {
    const res = await client.post(`/prediction/${chatflowId}`, {
      question: 'Hello, how are you?',
      streaming: false,
    })

    log.info('prediction response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = PredictionResponseSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.text).toBeTruthy()
      expect(parsed.data.question).toBe('Hello, how are you?')
      expect(parsed.data.chatId).toBeTruthy()
    }

    if (shouldRecord()) {
      recorder.record('prediction/nonstream', body)
    }
  })

  it('returns JSON content-type', async () => {
    const res = await client.post(`/prediction/${chatflowId}`, {
      question: 'Test content type',
      streaming: false,
    })

    expect(res.status).toBe(200)

    const contentType = res.headers.get('content-type')
    expect(contentType).toContain('application/json')
  })

  it('handles unicode questions', async () => {
    const res = await client.post(`/prediction/${chatflowId}`, {
      question: '你好世界 🌍 مرحبا こんにちは',
      streaming: false,
    })

    expect(res.status).toBe(200)

    const body = res.json<{ question: string }>()
    expect(body.question).toBe('你好世界 🌍 مرحبا こんにちは')
  })

  it('handles long questions', async () => {
    const longQuestion = 'a'.repeat(10_000)
    const res = await client.post(`/prediction/${chatflowId}`, {
      question: longQuestion,
      streaming: false,
    })

    expect(res.status).toBe(200)
  })
})
