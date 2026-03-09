/**
 * In-memory store for evaluation runs.
 * Tracks the results of running a dataset against a chatflow.
 */

import { randomUUID } from 'node:crypto'

export interface EvaluationResult {
  readonly input: string
  readonly expectedOutput: string
  readonly actualOutput: string
  readonly passed: boolean
  readonly latencyMs: number
}

export interface EvaluationSummary {
  readonly total: number
  readonly passed: number
  readonly failed: number
  readonly avgLatencyMs: number
}

export type EvaluationStatus = 'running' | 'completed' | 'failed'

export interface EvaluationRun {
  readonly id: string
  readonly datasetId: string
  readonly chatflowId: string
  readonly status: EvaluationStatus
  readonly results: readonly EvaluationResult[]
  readonly summary: EvaluationSummary
  readonly createdDate: string
  readonly completedDate?: string
}

const store = new Map<string, EvaluationRun>()

export function getAllEvaluations(): EvaluationRun[] {
  return [...store.values()]
}

export function getEvaluation(id: string): EvaluationRun | undefined {
  return store.get(id)
}

export function createEvaluationRun(datasetId: string, chatflowId: string): EvaluationRun {
  const run: EvaluationRun = {
    id: randomUUID(),
    datasetId,
    chatflowId,
    status: 'running',
    results: [],
    summary: { total: 0, passed: 0, failed: 0, avgLatencyMs: 0 },
    createdDate: new Date().toISOString(),
  }
  store.set(run.id, run)
  return run
}

export function completeEvaluationRun(id: string, results: readonly EvaluationResult[]): EvaluationRun | undefined {
  const existing = store.get(id)
  if (!existing) return undefined

  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed
  const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0)

  const updated: EvaluationRun = {
    ...existing,
    status: 'completed',
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      avgLatencyMs: results.length > 0 ? totalLatency / results.length : 0,
    },
    completedDate: new Date().toISOString(),
  }
  store.set(id, updated)
  return updated
}

export function failEvaluationRun(id: string, _error: string): EvaluationRun | undefined {
  const existing = store.get(id)
  if (!existing) return undefined

  const updated: EvaluationRun = {
    ...existing,
    status: 'failed',
    completedDate: new Date().toISOString(),
  }
  store.set(id, updated)
  return updated
}

export function deleteEvaluation(id: string): boolean {
  return store.delete(id)
}

/** Reset for testing. */
export function _resetEvaluations(): void {
  store.clear()
}
