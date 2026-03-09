import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { VALID_FLOW_DATA } from '../../src/fixtures.js'
import { PredictionResponseSchema } from '../../src/schemas.js'
import { client, hasLLM, log, recorder, shouldRecord } from '../../src/setup.js'

describe.skipIf(!hasLLM)('03 — Prediction (non-streaming)', () => {
  let chatflowId: string

  beforeAll(async () => {
    const res = await client.post('/chatflows', {
      name: 'prediction-test-flow',
      flowData: VALID_FLOW_DATA,
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
    const parsed = PredictionResponseSchema.parse(body)
    expect(parsed.text).toBeTypeOf('string')
    expect(parsed.question).toBe('Hello, how are you?')
    expect(parsed.chatId).toBeTypeOf('string')

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
