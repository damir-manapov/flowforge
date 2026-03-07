import { randomUUID } from 'node:crypto'
import { deleteTool as deleteFromStore, getToolById, setTool, type Tool } from '../storage/toolStore.js'

export type { Tool } from '../storage/toolStore.js'
export { clearToolStore, getAllTools, getToolById } from '../storage/toolStore.js'

interface ToolInput {
  name: string
  description: string
  color: string
  iconSrc?: string | null
  schema?: string | null
  func?: string | null
}

function now(): string {
  return new Date().toISOString()
}

export function createTool(input: ToolInput): Tool {
  const id = randomUUID()
  const timestamp = now()

  const tool: Tool = {
    id,
    name: input.name,
    description: input.description,
    color: input.color,
    iconSrc: input.iconSrc ?? null,
    schema: input.schema ?? null,
    func: input.func ?? null,
    createdDate: timestamp,
    updatedDate: timestamp,
  }

  setTool(tool)
  return tool
}

export function updateTool(id: string, input: Partial<ToolInput>): Tool | undefined {
  const existing = getToolById(id)
  if (!existing) return undefined

  const updated: Tool = {
    ...existing,
    ...input,
    id,
    createdDate: existing.createdDate,
    updatedDate: now(),
  }

  setTool(updated)
  return updated
}

export function deleteTool(id: string): { raw: unknown[]; affected: number } {
  const deleted = deleteFromStore(id)
  return { raw: [], affected: deleted ? 1 : 0 }
}
