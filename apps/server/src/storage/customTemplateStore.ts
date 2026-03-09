/**
 * In-memory store for custom marketplace templates.
 * Users can save their own flows as reusable templates.
 */

import { randomUUID } from 'node:crypto'

export interface CustomTemplate {
  readonly id: string
  readonly templateName: string
  readonly flowData: string
  readonly description: string
  readonly framework: readonly string[]
  readonly usecases: readonly string[]
  readonly categories: readonly string[]
  readonly type: string
  readonly createdDate: string
}

interface CreateInput {
  readonly templateName: string
  readonly flowData: string
  readonly description: string
  readonly framework: readonly string[]
  readonly usecases: readonly string[]
  readonly type: string
}

const store = new Map<string, CustomTemplate>()

export function getCustomTemplates(): CustomTemplate[] {
  return [...store.values()]
}

export function addCustomTemplate(input: CreateInput): CustomTemplate {
  const id = randomUUID()
  const template: CustomTemplate = {
    id,
    templateName: input.templateName,
    flowData: input.flowData,
    description: input.description,
    framework: input.framework,
    usecases: input.usecases,
    categories: [],
    type: input.type,
    createdDate: new Date().toISOString(),
  }
  store.set(id, template)
  return template
}

export function deleteCustomTemplate(id: string): boolean {
  return store.delete(id)
}

/** Reset for testing. */
export function _resetCustomTemplates(): void {
  store.clear()
}
