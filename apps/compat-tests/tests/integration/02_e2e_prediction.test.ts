/**
 * End-to-end prediction test using real Deepseek API credentials.
 *
 * Covers:
 *  - Credential creation (deepseekApi)
 *  - Chatflow creation (ChatDeepseek + BufferMemory + ConversationChain)
 *  - Streaming prediction with **missing** credential → SSE error event
 *  - Streaming prediction with **valid** credential → SSE token events
 *
 * Skipped when DEEPSEEK_API_KEY is not set.
 *
 * Flow structure is derived from the mitmproxy capture
 * session-20260308-090959.jsonl (Flowise 3.0.13).
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFlowiseEvents } from '@flowforge/test-utils'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, deepseekApiKey, log } from '../../src/setup.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Helpers ──────────────────────────────────────────────────────────

/** Load the fixture flowData JSON and inject a credential ID. */
function buildFlowData(credentialId: string): string {
  const raw = readFileSync(resolve(__dirname, '../fixtures/deepseek-chatflow.json'), 'utf-8')
  return raw.replaceAll('CREDENTIAL_PLACEHOLDER', credentialId)
}

// ── Test suite ───────────────────────────────────────────────────────

const SKIP = !deepseekApiKey

describe.skipIf(SKIP)('Integration — E2E Prediction (Deepseek)', () => {
  let credentialId: string
  let chatflowId: string

  beforeAll(async () => {
    log.info('Creating Deepseek credential for E2E prediction test')

    // 1. Create credential
    const credRes = await client.post('/credentials', {
      name: 'e2e-deepseek-cred',
      credentialName: 'deepseekApi',
      plainDataObj: { deepseekApiKey: deepseekApiKey },
    })
    expect(credRes.status).toBe(200)
    const cred = credRes.json<{ id: string }>()
    credentialId = cred.id
    log.info('Created credential', { credentialId })

    // 2. Create chatflow with the credential wired in
    const flowData = buildFlowData(credentialId)
    const cfRes = await client.post('/chatflows', {
      name: 'e2e-deepseek-chatflow',
      flowData,
      deployed: false,
      isPublic: false,
      type: 'CHATFLOW',
    })
    expect(cfRes.status).toBe(200)
    const cf = cfRes.json<{ id: string }>()
    chatflowId = cf.id
    log.info('Created chatflow', { chatflowId })
  })

  afterAll(async () => {
    // Clean up in reverse order
    if (chatflowId) {
      await client.delete(`/chatflows/${chatflowId}`)
      log.info('Deleted chatflow', { chatflowId })
    }
    if (credentialId) {
      await client.delete(`/credentials/${credentialId}`)
      log.info('Deleted credential', { credentialId })
    }
  })

  // ── Missing-credential error via SSE ─────────────────────────────

  it('returns SSE error event when credential is missing', async () => {
    // Build a chatflow whose credential points to a non-existent ID
    const badFlowData = buildFlowData('00000000-0000-0000-0000-000000000000')
    const badCfRes = await client.post('/chatflows', {
      name: 'e2e-missing-cred-flow',
      flowData: badFlowData,
      deployed: false,
      isPublic: false,
      type: 'CHATFLOW',
    })
    expect(badCfRes.status).toBe(200)
    const badCf = badCfRes.json<{ id: string }>()

    try {
      const { collectSSE } = await import('@flowforge/test-utils')

      const url = client.getRawUrl(`/prediction/${badCf.id}`)
      const headers = client.getDefaultHeaders()

      const result = await collectSSE(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: 'this should fail',
          streaming: true,
        }),
        timeout: 15_000,
      })

      const events = parseFlowiseEvents(result.events)
      log.info('Missing-cred SSE events', { count: events.length, types: events.map((e) => e.event) })

      // Expect at least an error event
      const errorEvent = events.find((e) => e.event === 'error')
      expect(errorEvent).toBeDefined()
      // Flowise 3.0 says "credential", 3.1+ says "api key not found"
      expect(errorEvent?.data.toLowerCase()).toMatch(/credential|api.key/)

      // Stream should end
      const endEvent = events.find((e) => e.event === 'end')
      expect(endEvent).toBeDefined()
    } finally {
      await client.delete(`/chatflows/${badCf.id}`)
    }
  })

  // ── Successful streaming prediction ──────────────────────────────

  it('streams real tokens from Deepseek', async () => {
    const { collectSSE } = await import('@flowforge/test-utils')

    const url = client.getRawUrl(`/prediction/${chatflowId}`)
    const headers = client.getDefaultHeaders()

    const result = await collectSSE(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: 'What is 2 + 3? Answer with just the number.',
        streaming: true,
      }),
      timeout: 30_000,
    })

    const events = parseFlowiseEvents(result.events)
    log.info('Prediction SSE events', {
      count: events.length,
      types: [...new Set(events.map((e) => e.event))],
      durationMs: result.durationMs,
    })

    // Should have a start event
    expect(events.find((e) => e.event === 'start')).toBeDefined()

    // Should have token events with actual content
    const tokenEvents = events.filter((e) => e.event === 'token')
    expect(tokenEvents.length).toBeGreaterThan(0)

    const fullText = tokenEvents.map((e) => e.data).join('')
    log.info('Prediction response text', { fullText: fullText.slice(0, 200) })

    // Metadata with chatId etc.
    const metaEvent = events.find((e) => e.event === 'metadata')
    if (!metaEvent) throw new Error('expected metadata event')

    const meta = JSON.parse(metaEvent.data) as Record<string, unknown>
    log.info('Metadata shape', { keys: Object.keys(meta), meta })
    expect(meta.chatId).toBeTypeOf('string')
    expect(meta.chatMessageId).toBeTypeOf('string')
    expect(meta.sessionId).toBeTypeOf('string')

    // Stream should end
    const endEvent = events.find((e) => e.event === 'end')
    expect(endEvent).toBeDefined()
  }, 60_000) // long timeout for real LLM call
})
