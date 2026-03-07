export interface Variable {
  id: string
  name: string
  value: string
  type: string
  createdDate: string
  updatedDate: string
}

const store = new Map<string, Variable>()

export function getAllVariables(): Variable[] {
  return Array.from(store.values())
}

export function getVariableById(id: string): Variable | undefined {
  return store.get(id)
}

export function setVariable(variable: Variable): void {
  store.set(variable.id, variable)
}

export function deleteVariable(id: string): boolean {
  return store.delete(id)
}

export function clearVariableStore(): void {
  store.clear()
}
