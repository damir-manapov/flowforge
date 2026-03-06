import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTempFile, cleanupTemp } from '@flowforge/test-utils'
import { readFileSync } from 'node:fs'
import { client, shouldRecord, recorder, log } from '../../src/setup.js'
import { AttachmentResponseSchema } from '../../src/schemas.js'

describe('06 — Attachments Upload', () => {
  let chatflowId: string
  const chatId = 'test-chat-id'

  beforeAll(async () => {
    const res = await client.post('/chatflows', {
      name: 'attachment-test-flow',
      flowData: '{}',
      deployed: false,
      isPublic: false,
      apikeyid: '',
      type: 'CHATFLOW',
    })
    const body = res.json<{ id: string }>()
    chatflowId = body.id
    log.info('created chatflow for attachment tests', { chatflowId })
  })

  afterAll(async () => {
    cleanupTemp()
    if (chatflowId) {
      await client.delete(`/chatflows/${chatflowId}`)
    }
  })

  it('uploads a single file', async () => {
    const filePath = createTempFile('Hello, this is a test file content.', 'test.txt')
    const fileContent = readFileSync(filePath)

    const res = await client.postMultipart(`/attachments/${chatflowId}/${chatId}`, [
      {
        name: 'files',
        value: new Blob([fileContent], { type: 'text/plain' }),
        filename: 'test.txt',
      },
    ])

    log.info('upload response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = AttachmentResponseSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.files).toHaveLength(1)
      expect(parsed.data.chatflowId).toBe(chatflowId)
    }

    if (shouldRecord()) {
      recorder.record('attachments/single-upload', body)
    }
  })

  it('uploads multiple files', async () => {
    const file1 = createTempFile('File one content', 'file1.txt')
    const file2 = createTempFile('File two content', 'file2.txt')
    const content1 = readFileSync(file1)
    const content2 = readFileSync(file2)

    const res = await client.postMultipart(`/attachments/${chatflowId}/${chatId}`, [
      {
        name: 'files',
        value: new Blob([content1], { type: 'text/plain' }),
        filename: 'file1.txt',
      },
      {
        name: 'files',
        value: new Blob([content2], { type: 'text/plain' }),
        filename: 'file2.txt',
      },
    ])

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = AttachmentResponseSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.files).toHaveLength(2)
    }
  })

  it('returns 404 for non-existent chatflow', async () => {
    const filePath = createTempFile('content', 'test.txt')
    const fileContent = readFileSync(filePath)

    const res = await client.postMultipart('/attachments/00000000-0000-0000-0000-000000000000/test-chat', [
      {
        name: 'files',
        value: new Blob([fileContent], { type: 'text/plain' }),
        filename: 'test.txt',
      },
    ])

    expect(res.status).toBe(404)
  })

  it('returns error when no files uploaded', async () => {
    const res = await client.postMultipart(`/attachments/${chatflowId}/${chatId}`, [])

    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
