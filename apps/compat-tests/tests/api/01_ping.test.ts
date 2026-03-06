import { describe, it, expect } from 'vitest'
import { client, shouldRecord, recorder, log } from '../../src/setup.js'

describe('01 — Ping / Connectivity', () => {
  it('GET /ping returns 200', async () => {
    const res = await client.get('/ping')
    log.info('ping response', { status: res.status, body: res.text })

    expect(res.status).toBe(200)

    if (shouldRecord()) {
      recorder.record('ping/response', { status: res.status, body: res.text })
    }
  })

  it('GET /ping returns "pong" body', async () => {
    const res = await client.get('/ping')

    expect(res.text).toContain('pong')
  })

  it('responds within reasonable time', async () => {
    const start = Date.now()
    await client.get('/ping')
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(5000)
  })
})
