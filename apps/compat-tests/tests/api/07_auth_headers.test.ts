import { HttpClient } from '@flowforge/test-utils'
import { describe, expect, it } from 'vitest'
import { log, testConfig } from '../../src/setup.js'

describe('07 — Auth & Headers', () => {
  it('accepts requests with valid auth header', async () => {
    const authClient = new HttpClient(testConfig.baseUrl, testConfig.authToken)
    const res = await authClient.get('/ping')

    log.info('auth ping response', { status: res.status })
    expect(res.status).toBe(200)
  })

  it('accepts custom headers', async () => {
    const authClient = new HttpClient(testConfig.baseUrl, testConfig.authToken)
    const res = await authClient.get('/ping', {
      'X-Custom-Header': 'test-value',
      'X-Request-Id': 'compat-test-12345',
    })

    expect(res.status).toBe(200)
  })

  it('response includes standard headers', async () => {
    const authClient = new HttpClient(testConfig.baseUrl, testConfig.authToken)
    const res = await authClient.get('/chatflows')

    expect(res.headers.get('content-type')).toBeTruthy()
  })

  it('handles missing auth gracefully for public endpoints', async () => {
    const noAuthClient = new HttpClient(testConfig.baseUrl)
    const res = await noAuthClient.get('/ping')

    expect(res.status).toBe(200)
  })
})
