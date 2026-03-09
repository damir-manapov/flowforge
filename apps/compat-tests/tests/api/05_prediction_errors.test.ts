import { describe, expect, it } from 'vitest'
import { client, log } from '../../src/setup.js'

describe('05 — Prediction Errors', () => {
  it('returns error for non-existent flowId', async () => {
    const res = await client.post('/prediction/00000000-0000-0000-0000-000000000000', {
      question: 'test',
      streaming: false,
    })

    log.info('prediction 404 response', { status: res.status })

    expect(res.status).toBe(404)
  })

  it('returns error for empty question', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'error-test-flow',
      flowData: '{"nodes":[],"edges":[]}',
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

      // Empty graph — Flowise validates graph structure before reading the question.
      expect(res.status).toBe(500)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('returns error for missing question field', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'missing-q-flow',
      flowData: '{"nodes":[],"edges":[]}',
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

      // Empty graph — Flowise validates graph structure before reading the question.
      expect(res.status).toBe(500)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('returns error for invalid JSON body', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'invalid-json-flow',
      flowData: '{"nodes":[],"edges":[]}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const chatflow = createRes.json<{ id: string }>()

    try {
      const res = await client.postRaw(`/prediction/${chatflow.id}`, 'not valid json{{{', 'application/json')

      expect(res.status).toBe(400)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('returns error for wrong content-type', async () => {
    const createRes = await client.post('/chatflows', {
      name: 'wrong-ct-flow',
      flowData: '{"nodes":[],"edges":[]}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const chatflow = createRes.json<{ id: string }>()

    try {
      const res = await client.postRaw(`/prediction/${chatflow.id}`, '<xml>not json</xml>', 'text/xml')

      // Empty graph — Flowise validates graph structure before parsing the body.
      expect(res.status).toBe(500)
    } finally {
      await client.delete(`/chatflows/${chatflow.id}`)
    }
  })

  it('returns error for invalid flowId format', async () => {
    const res = await client.post('/prediction/not-a-uuid', {
      question: 'test',
      streaming: false,
    })

    expect(res.status).toBe(400)
  })
})
