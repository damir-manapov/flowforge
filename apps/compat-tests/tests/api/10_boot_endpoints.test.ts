import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { client, log, recorder, shouldRecord } from '../../src/setup.js'

const NodeSchema = z
  .object({
    label: z.string(),
    name: z.string(),
    type: z.string(),
    category: z.string(),
    description: z.string(),
    baseClasses: z.array(z.string()),
    inputs: z.array(z.unknown()),
    icon: z.string().optional(),
    version: z.number(),
  })
  .passthrough()

describe('10 — Boot Endpoints', () => {
  describe('GET /nodes', () => {
    it('returns 200 with an array', async () => {
      const res = await client.get('/nodes')
      const nodes = res.json<unknown[]>()
      log.info('nodes response', { status: res.status, count: nodes.length })

      expect(res.status).toBe(200)
      expect(Array.isArray(nodes)).toBe(true)

      if (shouldRecord()) {
        recorder.record('nodes/response', { status: res.status, count: nodes.length })
      }
    })

    it('returns node objects with expected shape', async () => {
      const res = await client.get('/nodes')
      const nodes = res.json<unknown[]>()

      expect(nodes.length).toBeGreaterThan(0)

      const result = NodeSchema.safeParse(nodes[0])
      expect(result.success).toBe(true)
    })

    it('returns nodes with known categories', async () => {
      const res = await client.get('/nodes')
      const nodes = res.json<Array<{ category: string }>>()

      const categories = [...new Set(nodes.map((n) => n.category))]
      log.info('node categories', { categories, count: categories.length })

      expect(categories.length).toBeGreaterThan(5)
    })
  })

  describe('GET /node-icon/:name', () => {
    it('returns 200 for a known icon', async () => {
      // First get a node to find a valid icon name
      const nodesRes = await client.get('/nodes')
      const nodes = nodesRes.json<Array<{ icon: string; name: string }>>()
      const nodeWithIcon = nodes.find((n) => n.icon && !n.icon.startsWith('http'))

      if (!nodeWithIcon) {
        log.info('no local icons found, skipping')
        return
      }

      const res = await client.get(`/node-icon/${nodeWithIcon.name}`)
      log.info('node-icon response', { status: res.status, icon: nodeWithIcon.icon })

      expect(res.status).toBe(200)
    })
  })

  describe.each([
    { path: '/credentials', label: 'credentials' },
    { path: '/components-credentials', label: 'components-credentials' },
    { path: '/apikey', label: 'apikey' },
    { path: '/tools', label: 'tools' },
    { path: '/assistants', label: 'assistants' },
    { path: '/variables', label: 'variables' },
    { path: '/document-store/store', label: 'document-store' },
    { path: '/marketplaces/templates', label: 'marketplaces' },
  ])('GET $path', ({ path, label }) => {
    it('returns 200 with an array', async () => {
      const res = await client.get(path)
      log.info(`${label} response`, { status: res.status })

      expect(res.status).toBe(200)

      const raw = res.json<unknown[]>()
      expect(Array.isArray(raw)).toBe(true)

      if (shouldRecord()) {
        recorder.record(`${label}/list`, { status: res.status, count: raw.length })
      }
    })
  })
})
