export interface Tool {
  id: string
  name: string
  description: string
  color: string
  iconSrc: string | null
  schema: string | null
  func: string | null
  createdDate: string
  updatedDate: string
}

const store = new Map<string, Tool>()

export function getAllTools(): Tool[] {
  return Array.from(store.values())
}

export function getToolById(id: string): Tool | undefined {
  return store.get(id)
}

export function setTool(tool: Tool): void {
  store.set(tool.id, tool)
}

export function deleteTool(id: string): boolean {
  return store.delete(id)
}

export function clearToolStore(): void {
  store.clear()
}
