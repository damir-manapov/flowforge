import { collectSSE, parseFlowiseEvents } from '@flowforge/test-utils'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { VALID_FLOW_DATA } from '../../src/fixtures.js'
import { client, hasLLM, log, recorder, shouldRecord } from '../../src/setup.js'

describe.skipIf(!hasLLM)('04 — Prediction SSE Streaming', () => {
  let chatflowId: string

  beforeAll(async () => {
    const res = await client.post('/chatflows', {
      name: 'stream-test-flow',
      flowData: VALID_FLOW_DATA,
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const body = res.json<{ id: string }>()
    chatflowId = body.id
    log.info('created test chatflow for streaming', { chatflowId })
  })

  afterAll(async () => {
    if (chatflowId) {
      await client.delete(`/chatflows/${chatflowId}`)
    }
  })

  it('POST /prediction/:flowId with streaming=true returns SSE', async () => {
    const url = client.getRawUrl(`/prediction/${chatflowId}`)
    const headers = client.getDefaultHeaders()

    const result = await collectSSE(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: 'Stream test',
        streaming: true,
      }),
      timeout: 30_000,
    })

    log.info('SSE result', {
      eventCount: result.events.length,
      durationMs: result.durationMs,
    })

    expect(result.events.length).toBeGreaterThanOrEqual(3)

    const parsed = parseFlowiseEvents(result.events)

    const tokenEvents = parsed.filter((e) => e.event === 'token')
    expect(tokenEvents.length).toBeGreaterThan(0)

    const startEvents = parsed.filter((e) => e.event === 'start')
    expect(startEvents.length).toBe(1)

    const endEvents = parsed.filter((e) => e.event === 'end')
    expect(endEvents.length).toBe(1)

    if (shouldRecord()) {
      recorder.record('prediction/stream-sse', {
        eventCount: result.events.length,
        tokenCount: tokenEvents.length,
        events: parsed.map((e) => ({ event: e.event, dataLength: e.data.length })),
      })
    }
  })

  it('SSE end event contains valid JSON payload', async () => {
    const url = client.getRawUrl(`/prediction/${chatflowId}`)
    const headers = client.getDefaultHeaders()

    const result = await collectSSE(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: 'End payload test',
        streaming: true,
      }),
    })

    const parsed = parseFlowiseEvents(result.events)

    const metaEvent = parsed.find((e) => e.event === 'metadata')
    expect(metaEvent).toBeDefined()
    if (!metaEvent) throw new Error('expected metadata event')

    const payload = JSON.parse(metaEvent.data)
    expect(payload.chatId).toBeTypeOf('string')
    expect(payload.chatMessageId).toBeTypeOf('string')
    expect(payload.sessionId).toBeTypeOf('string')

    const endEvent = parsed.find((e) => e.event === 'end')
    expect(endEvent).toBeDefined()
  })

  it('SSE timing metadata is reasonable', async () => {
    const url = client.getRawUrl(`/prediction/${chatflowId}`)
    const headers = client.getDefaultHeaders()

    const result = await collectSSE(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: 'Timing test',
        streaming: true,
      }),
    })

    expect(result.startedAt).toBeLessThanOrEqual(result.endedAt)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.durationMs).toBeLessThan(30_000)
  })
})
