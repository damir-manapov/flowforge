import { describe, it, expect } from 'vitest'
import { client, log } from '../../src/setup.js'
import { ErrorResponseSchema } from '../../src/schemas.js'

describe('05 — Prediction Errors', () => {
  it('returns 404 for non-existent flowId', async () => {
    const res = await client.post('/prediction/00000000-0000-0000-0000-000000000000', {
      question: 'test',
      streaming: false,
    })

    log.info('prediction 404 response', { status: res.status })

    expect(res.status).toBe(404)

    const body = res.json()
    const parsed = ErrorResponseSchema.safeParse(body)
    expect(parsed.success).toBe(true)
  })

  it('returns error for empty question', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'error-test-flow',
      flowData: '{}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const chatflow = createRes.json<{ id: string }>()

    try {
      const res = await client.post(`/prediction/${chatflow.id}`, {
        question: '',
        streaming: false,
      })

      expect(res.status).toBeGreaterThanOrEqual(400)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('returns error for missing question field', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'missing-q-flow',
      flowData: '{}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const chatflow = createRes.json<{ id: string }>()

    try {
      const res = await client.post(`/prediction/${chatflow.id}`, {
        streaming: false,
      })

      expect(res.status).toBeGreaterThanOrEqual(400)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('returns error for invalid JSON body', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'invalid-json-flow',
      flowData: '{}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const chatflow = createRes.json<{ id: string }>()

    try {
      const res = await client.postRaw(`/prediction/${chatflow.id}`, 'not valid json{{{', 'application/json')

      expect(res.status).toBeGreaterThanOrEqual(400)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('returns error for wrong content-type', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'wrong-ct-flow',
      flowData: '{}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const chatflow = createRes.json<{ id: string }>()

    try {
      const res = await client.postRaw(`/prediction/${chatflow.id}`, '<xml>not json</xml>', 'text/xml')

      expect(res.status).toBeGreaterThanOrEqual(400)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('returns error for invalid flowId format', async () => {
    const res = await client.post('/prediction/not-a-uuid', {
      question: 'test',
      streaming: false,
    })

    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
