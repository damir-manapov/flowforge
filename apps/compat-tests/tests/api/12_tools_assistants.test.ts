import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AssistantListSchema,
  AssistantSchema,
  DeleteResultSchema,
  ToolListSchema,
  ToolSchema,
} from '../../src/schemas.js'
import { client, log } from '../../src/setup.js'

// Assistants CRUD requires local-only persistence (no OpenAI API calls).
// Flowise calls openai.beta.assistants.create() which needs real credentials,
// so we can only run these tests against our reimplementation.
const hasLocalAssistants = process.env.TARGET_NAME === 'reimpl'

describe('12 — Tools CRUD', () => {
  let createdId: string

  beforeAll(() => {
    log.info('Starting tools CRUD tests')
  })

  afterAll(async () => {
    if (createdId) {
      await client.delete(`/tools/${createdId}`)
    }
  })

  it('POST /tools creates a tool', async () => {
    const res = await client.post('/tools', {
      name: 'compat-test-tool',
      description: 'A test tool for compat testing',
      color: '#FF5733',
      schema: '{}',
      func: 'return "hello"',
    })

    log.info('create tool response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ToolSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      createdId = parsed.data.id
      expect(parsed.data.name).toBe('compat-test-tool')
      expect(parsed.data.description).toBe('A test tool for compat testing')
      expect(parsed.data.color).toBe('#FF5733')
      expect(parsed.data.schema).toBe('{}')
      expect(parsed.data.func).toBe('return "hello"')
    }
  })

  it('GET /tools returns a list including the created tool', async () => {
    const res = await client.get('/tools')

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ToolListSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const found = parsed.data.find((t) => t.id === createdId)
      expect(found).toBeDefined()
      expect(found?.name).toBe('compat-test-tool')
    }
  })

  it('PUT /tools/:id updates a tool', async () => {
    const res = await client.put(`/tools/${createdId}`, {
      name: 'updated-tool',
    })

    log.info('update tool response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = ToolSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe('updated-tool')
      // Other fields should be preserved
      expect(parsed.data.color).toBe('#FF5733')
    }
  })

  it('DELETE /tools/:id deletes a tool', async () => {
    const res = await client.delete(`/tools/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = DeleteResultSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.affected).toBe(1)
    }

    // Mark as cleaned up
    createdId = ''
  })

  it('GET /tools after delete does not include removed tool', async () => {
    const res = await client.get('/tools')

    expect(res.status).toBe(200)
    const body = res.json() as Array<{ name: string }>
    expect(body.find((t) => t.name === 'updated-tool')).toBeUndefined()
  })
})

describe('12 — Assistants CRUD', { skip: !hasLocalAssistants }, () => {
  // Flowise assistants require real OpenAI credentials + API calls.
  // Our reimplementation does local persistence only.
  let createdId: string

  beforeAll(() => {
    log.info('Starting assistants CRUD tests (reimpl only)')
  })

  afterAll(async () => {
    if (createdId) {
      await client.delete(`/assistants/${createdId}`)
    }
  })

  it('POST /assistants creates an assistant', async () => {
    const res = await client.post('/assistants', {
      details: JSON.stringify({ name: 'test-assistant', description: 'A test' }),
      credential: '',
      iconSrc: null,
    })

    log.info('create assistant response', { status: res.status })

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = AssistantSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      createdId = parsed.data.id
      const details = JSON.parse(parsed.data.details) as { name: string }
      expect(details.name).toBe('test-assistant')
    }
  })

  it('GET /assistants returns a list', async () => {
    const res = await client.get('/assistants')

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = AssistantListSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const found = parsed.data.find((a) => a.id === createdId)
      expect(found).toBeDefined()
    }
  })

  it('DELETE /assistants/:id deletes an assistant', async () => {
    const res = await client.delete(`/assistants/${createdId}`)

    expect(res.status).toBe(200)

    const body = res.json()
    const parsed = DeleteResultSchema.safeParse(body)
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.affected).toBe(1)
    }

    createdId = ''
  })
})
