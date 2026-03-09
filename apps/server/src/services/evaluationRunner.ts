/**
 * Evaluation runner — runs a dataset against a chatflow and collects results.
 *
 * Comparison strategies:
 *  - exactMatch: output must equal expected (case-insensitive, trimmed)
 *  - contains:   output must contain expected substring
 *  - regex:      output must match expected as a regex pattern
 */

import type { DatasetItem } from '../storage/datasetStore.js'
import { getDataset } from '../storage/datasetStore.js'
import type { EvaluationResult, EvaluationRun } from '../storage/evaluationStore.js'
import { completeEvaluationRun, createEvaluationRun, failEvaluationRun } from '../storage/evaluationStore.js'
import { generateStubResponse } from './predictionService.js'

// ── Comparison strategies ────────────────────────────────────────────

export type ComparisonStrategy = 'exactMatch' | 'contains' | 'regex'

export function compareExactMatch(actual: string, expected: string): boolean {
  return actual.trim().toLowerCase() === expected.trim().toLowerCase()
}

export function compareContains(actual: string, expected: string): boolean {
  return actual.toLowerCase().includes(expected.toLowerCase())
}

export function compareRegex(actual: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(actual)
  } catch {
    return false
  }
}

export function compare(actual: string, expected: string, strategy: ComparisonStrategy): boolean {
  switch (strategy) {
    case 'exactMatch':
      return compareExactMatch(actual, expected)
    case 'contains':
      return compareContains(actual, expected)
    case 'regex':
      return compareRegex(actual, expected)
  }
}

// ── Prediction function type ─────────────────────────────────────────

/** Pluggable prediction function for testability. */
export type PredictFn = (input: string) => Promise<string>

/** Default prediction function using the stub response generator. */
function defaultPredict(input: string): Promise<string> {
  const result = generateStubResponse(input)
  return Promise.resolve(result.text)
}

// ── Runner ───────────────────────────────────────────────────────────

export interface RunEvaluationOptions {
  readonly datasetId: string
  readonly chatflowId: string
  readonly strategy?: ComparisonStrategy
  /** Override the prediction function (for testing or real LLM calls). */
  readonly predictFn?: PredictFn
}

/**
 * Run an evaluation: iterate over dataset items, collect predictions,
 * compare outputs, and store results.
 */
export async function runEvaluation(options: RunEvaluationOptions): Promise<EvaluationRun> {
  const { datasetId, chatflowId, strategy = 'contains' } = options
  const predictFn = options.predictFn ?? defaultPredict

  const dataset = getDataset(datasetId)
  if (!dataset) {
    throw new Error(`Dataset ${datasetId} not found`)
  }

  const run = createEvaluationRun(datasetId, chatflowId)

  try {
    const results = await evaluateItems(dataset.items, predictFn, strategy)
    const completed = completeEvaluationRun(run.id, results)
    if (!completed) {
      throw new Error(`Failed to complete evaluation run ${run.id}`)
    }
    return completed
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    failEvaluationRun(run.id, message)
    throw err
  }
}

async function evaluateItems(
  items: readonly DatasetItem[],
  predictFn: PredictFn,
  strategy: ComparisonStrategy,
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = []

  for (const item of items) {
    const start = performance.now()
    const actualOutput = await predictFn(item.input)
    const latencyMs = Math.round(performance.now() - start)
    const passed = compare(actualOutput, item.expectedOutput, strategy)

    results.push({
      input: item.input,
      expectedOutput: item.expectedOutput,
      actualOutput,
      passed,
      latencyMs,
    })
  }

  return results
}
