import { describe, expect, it } from 'vitest'
import {
  _resetCustomTemplates,
  addCustomTemplate,
  deleteCustomTemplate,
  getCustomTemplates,
} from '../src/storage/customTemplateStore.js'

describe('customTemplateStore', () => {
  it('starts empty', () => {
    _resetCustomTemplates()
    expect(getCustomTemplates()).toEqual([])
  })

  it('adds a custom template with generated id', () => {
    _resetCustomTemplates()
    const tpl = addCustomTemplate({
      templateName: 'My Flow',
      flowData: '{"nodes":[],"edges":[]}',
      description: 'A test flow',
      framework: ['Langchain'],
      usecases: ['Testing'],
      type: 'Chatflow',
    })
    expect(tpl.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(tpl.templateName).toBe('My Flow')
    expect(tpl.createdDate).toBeTruthy()
    expect(getCustomTemplates()).toHaveLength(1)
  })

  it('deletes a template by id', () => {
    _resetCustomTemplates()
    const tpl = addCustomTemplate({
      templateName: 'To Delete',
      flowData: '{}',
      description: '',
      framework: [],
      usecases: [],
      type: 'Chatflow',
    })
    expect(deleteCustomTemplate(tpl.id)).toBe(true)
    expect(getCustomTemplates()).toHaveLength(0)
  })

  it('returns false when deleting non-existent id', () => {
    _resetCustomTemplates()
    expect(deleteCustomTemplate('non-existent')).toBe(false)
  })
})
