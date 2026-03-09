import { describe, expect, it } from 'vitest'
import { VALID_FLOW_DATA } from '../../src/fixtures.js'
import { client, hasLLM, log } from '../../src/setup.js'

describe('09 — Regression & Quirks', () => {
  it('handles trailing slashes gracefully', async () => {
    const res = await client.get('/ping/')

    log.info('trailing slash response', { status: res.status })

    // Both Express and Fastify (ignoreTrailingSlash) normalise /ping/ → /ping.
    expect(res.status).toBe(200)
  })

  it('handles double slashes in path', async () => {
    const res = await client.get('//ping')

    // Both Express and Fastify (ignoreDuplicateSlashes) normalise //ping → /ping.
    expect(res.status).toBe(200)
  })

  it('GET on non-existent route does not crash', async () => {
    const res = await client.get('/nonexistent-route')

    // Both targets serve an SPA fallback (200 with HTML) for unknown GET routes.
    expect(res.status).toBe(200)
  })

  it.skipIf(!hasLLM)('handles very large JSON body gracefully', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'large-body-flow',
      flowData: VALID_FLOW_DATA,
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const chatflow = createRes.json<{ id: string }>()

    try {
      const largeOverride: Record<string, string> = {}
      for (let i = 0; i < 100; i++) {
        largeOverride[`key_${i}`] = 'x'.repeat(1000)
      }

      const res = await client.post(`/prediction/${chatflow.id}`, {
        question: 'Large body test',
        streaming: false,
        overrideConfig: largeOverride,
      })

      // Both targets return 200 for valid prediction requests.
      expect(res.status).toBe(200)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('handles unicode in chatflow name', async () => {
    const res = await client.post('/chatflows', {
      name: '测试流程 🚀 тест',
      flowData: '{"nodes":[],"edges":[]}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })

    expect(res.status).toBe(200)

    const body = res.json<{ id: string; name: string }>()
    expect(body.name).toBe('测试流程 🚀 тест')

    await client.delete(`/chatflows/${body.id}`)
  })

  it('handles rapid create-delete cycles', async () => {
    for (let i = 0; i < 10; i++) {
      const createRes = await client.post('/chatflows', {
        name: `rapid-${i}`,
        flowData: '{"nodes":[],"edges":[]}',
        deployed: false,
        isPublic: false,
        apikeyid: '',
        type: 'CHATFLOW',
      })

      expect(createRes.status).toBe(200)

      const body = createRes.json<{ id: string }>()
      const deleteRes = await client.delete(`/chatflows/${body.id}`)

      expect(deleteRes.status).toBe(200)
    }
  })
})
