import { randomUUID } from 'node:crypto'
import {
  deleteVariable as deleteFromStore,
  getAllVariables as getAllFromStore,
  getVariableById,
  setVariable,
  type Variable,
} from '../storage/variableStore.js'

export type { Variable } from '../storage/variableStore.js'
export { clearVariableStore, getVariableById } from '../storage/variableStore.js'

interface VariableInput {
  name: string
  value?: string
  type?: string
}

function now(): string {
  return new Date().toISOString()
}

export function getAllVariables(): Variable[] {
  return getAllFromStore()
}

export function createVariable(input: VariableInput): Variable {
  const id = randomUUID()
  const timestamp = now()

  const variable: Variable = {
    id,
    name: input.name,
    value: input.value ?? '',
    type: input.type ?? 'static',
    createdDate: timestamp,
    updatedDate: timestamp,
  }

  setVariable(variable)
  return variable
}

export function updateVariable(id: string, input: Partial<VariableInput>): Variable | undefined {
  const existing = getVariableById(id)
  if (!existing) return undefined

  const updated: Variable = {
    ...existing,
    name: input.name ?? existing.name,
    value: input.value ?? existing.value,
    type: input.type ?? existing.type,
    updatedDate: now(),
  }

  setVariable(updated)
  return updated
}

export function deleteVariable(id: string): { raw: unknown[]; affected: number } {
  const deleted = deleteFromStore(id)
  return { raw: [], affected: deleted ? 1 : 0 }
}
