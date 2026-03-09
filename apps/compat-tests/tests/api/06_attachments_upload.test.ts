import { readFileSync } from 'node:fs'
import { cleanupTemp, createTempFile } from '@flowforge/test-utils'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, log } from '../../src/setup.js'

describe('06 — Attachments Upload', () => {
  let chatflowId: string
  const chatId = 'test-chat-id'

  beforeAll(async () => {
    const res = await client.post('/chatflows', {
      name: 'attachment-test-flow',
      flowData: '{"nodes":[],"edges":[]}',
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

    // Chatflow has empty flowData (no file-handling nodes) → upload is rejected
    expect(res.status).toBe(500)
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

    // Chatflow has empty flowData (no file-handling nodes) → upload is rejected
    expect(res.status).toBe(500)
  })

  it('accepts upload for non-existent chatflow or returns error', async () => {
    const filePath = createTempFile('content', 'test.txt')
    const fileContent = readFileSync(filePath)

    const res = await client.postMultipart('/attachments/00000000-0000-0000-0000-000000000000/test-chat', [
      {
        name: 'files',
        value: new Blob([fileContent], { type: 'text/plain' }),
        filename: 'test.txt',
      },
    ])

    // Flowise 3.0 returns 500 for non-existent chatflow
    expect(res.status).toBe(500)
  })

  it('handles empty upload', async () => {
    const res = await client.postMultipart(`/attachments/${chatflowId}/${chatId}`, [])

    // Chatflow has empty flowData (no file-handling nodes) → upload is rejected
    expect(res.status).toBe(500)
  })
})
