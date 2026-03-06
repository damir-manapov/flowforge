import { describe, expect, it } from 'vitest'
import { client, hasLLM, log, testConfig } from '../../src/setup.js'

describe('Integration — Flowise Embed Smoke Test', () => {
  it('server responds to ping (client smoke test)', async () => {
    const res = await client.get('/ping')

    log.info('smoke test ping', { status: res.status, target: testConfig.targetName })

    expect(res.status).toBe(200)
  })

  it.skipIf(!hasLLM)('prediction endpoint accepts standard flowise-embed payload', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'embed-smoke-flow',
      flowData: '{"nodes":[],"edges":[]}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const chatflow = createRes.json<{ id: string }>()

    try {
      // Simulate the payload format flowise-embed sends
      const res = await client.post(`/prediction/${chatflow.id}`, {
        question: 'Hello from flowise-embed',
        history: [],
        overrideConfig: {},
        streaming: false,
      })

      log.info('embed smoke prediction', { status: res.status })

      expect(res.status).toBe(200)

      const body = res.json<{ text: string }>()
      expect(body.text).toBeTruthy()
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it.skipIf(!hasLLM)('streaming prediction works with flowise-embed payload format', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'embed-stream-smoke',
      flowData: '{"nodes":[],"edges":[]}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const chatflow = createRes.json<{ id: string }>()

    try {
      const { collectSSE } = await import('@flowforge/test-utils')

      const url = client.getRawUrl(`/prediction/${chatflow.id}`)
      const headers = client.getDefaultHeaders()

      const result = await collectSSE(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: 'Streaming from flowise-embed',
          history: [],
          overrideConfig: {},
          streaming: true,
        }),
      })

      expect(result.events.length).toBeGreaterThan(0)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })
})
