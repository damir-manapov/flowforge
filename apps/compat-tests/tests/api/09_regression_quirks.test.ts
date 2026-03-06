import { describe, it, expect } from 'vitest'
import { client, log } from '../../src/setup.js'

describe('09 — Regression & Quirks', () => {
  it('handles trailing slashes gracefully', async () => {
    const res = await client.get('/ping/')

    log.info('trailing slash response', { status: res.status })

    // Should either succeed or redirect, not 500
    expect(res.status).toBeLessThan(500)
  })

  it('handles double slashes in path', async () => {
    const res = await client.get('//ping')

    expect(res.status).toBeLessThan(500)
  })

  it('GET on non-existent route returns 404', async () => {
    const res = await client.get('/nonexistent-route')

    expect(res.status).toBe(404)
  })

  it('handles very large JSON body gracefully', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'large-body-flow',
      flowData: '{}',
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

      // Should not crash - any response is acceptable as long as it's not a 5xx caused by our handling
      expect(res.status).toBeLessThan(500)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('handles unicode in chatflow name', async () => {
    const res = await client.post('/chatflows', {
      name: '测试流程 🚀 тест',
      flowData: '{}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })

    expect(res.status).toBe(201)

    const body = res.json<{ id: string; name: string }>()
    expect(body.name).toBe('测试流程 🚀 тест')

    await client.delete(`/chatflows/${body.id}`)
  })

  it('handles rapid create-delete cycles', async () => {
    for (let i = 0; i < 10; i++) {
      const createRes = await client.post('/chatflows', {
        name: `rapid-${i}`,
        flowData: '{}',
        deployed: false,
        isPublic: false,
        apikeyid: '',
        type: 'CHATFLOW',
      })

      expect(createRes.status).toBe(201)

      const body = createRes.json<{ id: string }>()
      const deleteRes = await client.delete(`/chatflows/${body.id}`)

      expect(deleteRes.status).toBe(200)
    }
  })
})
