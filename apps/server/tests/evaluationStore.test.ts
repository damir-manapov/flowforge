import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetEvaluations,
  completeEvaluationRun,
  createEvaluationRun,
  deleteEvaluation,
  failEvaluationRun,
  getAllEvaluations,
  getEvaluation,
} from '../src/storage/evaluationStore.js'

afterEach(() => _resetEvaluations())

describe('evaluationStore', () => {
  it('creates a run in running state', () => {
    const run = createEvaluationRun('ds-1', 'cf-1')
    expect(run.id).toBeTruthy()
    expect(run.datasetId).toBe('ds-1')
    expect(run.chatflowId).toBe('cf-1')
    expect(run.status).toBe('running')
    expect(run.results).toEqual([])
    expect(run.summary).toEqual({ total: 0, passed: 0, failed: 0, avgLatencyMs: 0 })
  })

  it('completes a run with results and summary', () => {
    const run = createEvaluationRun('ds-1', 'cf-1')
    const results = [
      { input: 'a', expectedOutput: 'b', actualOutput: 'b', passed: true, latencyMs: 10 },
      { input: 'c', expectedOutput: 'd', actualOutput: 'x', passed: false, latencyMs: 20 },
    ]
    const completed = completeEvaluationRun(run.id, results)
    expect(completed?.status).toBe('completed')
    expect(completed?.results).toHaveLength(2)
    expect(completed?.summary).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
      avgLatencyMs: 15,
    })
    expect(completed?.completedDate).toBeTruthy()
  })

  it('returns undefined for completing nonexistent run', () => {
    expect(completeEvaluationRun('nope', [])).toBeUndefined()
  })

  it('fails a run', () => {
    const run = createEvaluationRun('ds-1', 'cf-1')
    const failed = failEvaluationRun(run.id, 'something broke')
    expect(failed?.status).toBe('failed')
    expect(failed?.completedDate).toBeTruthy()
  })

  it('returns undefined for failing nonexistent run', () => {
    expect(failEvaluationRun('nope', 'err')).toBeUndefined()
  })

  it('lists all evaluations', () => {
    createEvaluationRun('ds-1', 'cf-1')
    createEvaluationRun('ds-2', 'cf-2')
    expect(getAllEvaluations()).toHaveLength(2)
  })

  it('gets by id', () => {
    const run = createEvaluationRun('ds-1', 'cf-1')
    expect(getEvaluation(run.id)?.id).toBe(run.id)
    expect(getEvaluation('nonexistent')).toBeUndefined()
  })

  it('deletes an evaluation', () => {
    const run = createEvaluationRun('ds-1', 'cf-1')
    expect(deleteEvaluation(run.id)).toBe(true)
    expect(getEvaluation(run.id)).toBeUndefined()
    expect(deleteEvaluation(run.id)).toBe(false)
  })

  it('reset clears all evaluations', () => {
    createEvaluationRun('ds-1', 'cf-1')
    _resetEvaluations()
    expect(getAllEvaluations()).toHaveLength(0)
  })
})
