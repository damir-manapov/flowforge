import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { runConcurrent } from '@flowforge/test-utils'
import { client, log } from '../../src/setup.js'

describe('08 — Concurrency', () => {
  let chatflowId: string

  beforeAll(async () => {
    const res = await client.post('/chatflows', {
      name: 'concurrency-test-flow',
      flowData: '{}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const body = res.json<{ id: string }>()
    chatflowId = body.id
    log.info('created chatflow for concurrency tests', { chatflowId })
  })

  afterAll(async () => {
    if (chatflowId) {
      await client.delete(`/chatflows/${chatflowId}`)
    }
  })

  it('handles 10 parallel ping requests', async () => {
    const tasks = Array.from({ length: 10 }, () => async () => {
      const res = await client.get('/ping')
      return res.status
    })

    const result = await runConcurrent(tasks)

    log.info('parallel ping', {
      succeeded: result.succeeded,
      failed: result.failed,
      durationMs: result.durationMs,
    })

    expect(result.succeeded).toBe(10)
    expect(result.failed).toBe(0)
  })

  it('handles 5 parallel prediction requests', async () => {
    const tasks = Array.from({ length: 5 }, (_, i) => async () => {
      const res = await client.post(`/prediction/${chatflowId}`, {
        question: `Parallel question ${i}`,
        streaming: false,
      })
      return res.status
    })

    const result = await runConcurrent(tasks)

    log.info('parallel predictions', {
      succeeded: result.succeeded,
      failed: result.failed,
      durationMs: result.durationMs,
    })

    expect(result.succeeded).toBe(5)

    for (const r of result.results) {
      if (r.status === 'fulfilled') {
        expect(r.value).toBe(200)
      }
    }
  })

  it('handles parallel CRUD operations', async () => {
    const createTasks = Array.from({ length: 5 }, (_, i) => async () => {
      const res = await client.post('/chatflows', {
        name: `concurrent-flow-${i}`,
        flowData: '{}',
        deployed: false,
        isPublic: false,
        apikeyid: '',
        type: 'CHATFLOW',
      })
      return res.json<{ id: string }>()
    })

    const createResult = await runConcurrent(createTasks)
    expect(createResult.succeeded).toBe(5)

    const ids = createResult.results
      .filter((r): r is PromiseFulfilledResult<{ id: string }> => r.status === 'fulfilled')
      .map((r) => r.value.id)

    const deleteTasks = ids.map((id) => async () => {
      const res = await client.delete(`/chatflows/${id}`)
      return res.status
    })

    const deleteResult = await runConcurrent(deleteTasks)
    expect(deleteResult.succeeded).toBe(5)
  })
})
