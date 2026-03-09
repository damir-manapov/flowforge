import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface MarketplaceTemplate {
  id: string
  templateName: string
  flowData: string
  description: string
  framework: string[]
  usecases: string[]
  categories: string[]
  type: string
}

const templatesPath = resolve(import.meta.dirname, '..', 'data', 'marketplace-templates.json')
const templates: MarketplaceTemplate[] = JSON.parse(readFileSync(templatesPath, 'utf-8'))

describe('marketplace-templates.json integrity', () => {
  it('has at least 60 templates', () => {
    expect(templates.length).toBeGreaterThanOrEqual(60)
  })

  it('every template has required fields', () => {
    for (const tpl of templates) {
      expect(typeof tpl.id).toBe('string')
      expect(tpl.id.length).toBeGreaterThan(0)
      expect(typeof tpl.templateName).toBe('string')
      expect(tpl.templateName.length).toBeGreaterThan(0)
      expect(typeof tpl.flowData).toBe('string')
      expect(typeof tpl.description).toBe('string')
      expect(Array.isArray(tpl.framework)).toBe(true)
      expect(['Chatflow', 'Agentflow', 'Tool']).toContain(tpl.type)
    }
  })

  it('all template ids are unique', () => {
    const ids = templates.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all template names are unique', () => {
    const names = templates.map((t) => t.templateName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('flowData is valid JSON for each template', () => {
    for (const tpl of templates) {
      expect(() => JSON.parse(tpl.flowData)).not.toThrow()
    }
  })

  it('covers chatflows, agentflows, and tools', () => {
    const types = new Set(templates.map((t) => t.type))
    expect(types.has('Chatflow')).toBe(true)
    expect(types.has('Agentflow')).toBe(true)
    expect(types.has('Tool')).toBe(true)
  })
})
