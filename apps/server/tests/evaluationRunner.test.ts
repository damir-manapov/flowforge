import { afterEach, describe, expect, it } from 'vitest'
import {
  compare,
  compareContains,
  compareExactMatch,
  compareRegex,
  runEvaluation,
} from '../src/services/evaluationRunner.js'
import { _resetDatasets, createDataset } from '../src/storage/datasetStore.js'
import { _resetEvaluations } from '../src/storage/evaluationStore.js'

afterEach(() => {
  _resetDatasets()
  _resetEvaluations()
})

describe('comparison strategies', () => {
  it('exactMatch compares case-insensitively after trimming', () => {
    expect(compareExactMatch('  Hello  ', 'hello')).toBe(true)
    expect(compareExactMatch('hi', 'hello')).toBe(false)
  })

  it('contains checks substring (case-insensitive)', () => {
    expect(compareContains('Hello World', 'world')).toBe(true)
    expect(compareContains('abc', 'xyz')).toBe(false)
  })

  it('regex tests output against pattern', () => {
    expect(compareRegex('Order #12345', '\\d{5}')).toBe(true)
    expect(compareRegex('no digits', '\\d+')).toBe(false)
  })

  it('regex returns false on invalid pattern', () => {
    expect(compareRegex('text', '(invalid[')).toBe(false)
  })

  it('compare dispatches to correct strategy', () => {
    expect(compare('exact', 'exact', 'exactMatch')).toBe(true)
    expect(compare('has the word', 'word', 'contains')).toBe(true)
    expect(compare('abc123', '\\d+', 'regex')).toBe(true)
  })
})

describe('runEvaluation', () => {
  it('throws if dataset does not exist', async () => {
    await expect(runEvaluation({ datasetId: 'nope', chatflowId: 'cf-1' })).rejects.toThrow('Dataset nope not found')
  })

  it('runs evaluation with custom predictFn', async () => {
    const ds = createDataset({
      name: 'Test',
      items: [
        { input: 'hello', expectedOutput: 'hi' },
        { input: 'bye', expectedOutput: 'goodbye' },
      ],
    })

    const run = await runEvaluation({
      datasetId: ds.id,
      chatflowId: 'cf-1',
      strategy: 'contains',
      predictFn: async (input) => {
        if (input === 'hello') return 'hi there'
        return 'see you later'
      },
    })

    expect(run.status).toBe('completed')
    expect(run.results).toHaveLength(2)
    expect(run.results[0]?.passed).toBe(true) // "hi there" contains "hi"
    expect(run.results[1]?.passed).toBe(false) // "see you later" doesn't contain "goodbye"
    expect(run.summary.total).toBe(2)
    expect(run.summary.passed).toBe(1)
    expect(run.summary.failed).toBe(1)
  })

  it('uses exactMatch strategy when specified', async () => {
    const ds = createDataset({
      name: 'Exact',
      items: [{ input: 'q', expectedOutput: 'answer' }],
    })

    const run = await runEvaluation({
      datasetId: ds.id,
      chatflowId: 'cf-1',
      strategy: 'exactMatch',
      predictFn: async () => '  Answer  ',
    })

    expect(run.results[0]?.passed).toBe(true)
  })

  it('uses regex strategy when specified', async () => {
    const ds = createDataset({
      name: 'Regex',
      items: [{ input: 'q', expectedOutput: '^\\d+$' }],
    })

    const run = await runEvaluation({
      datasetId: ds.id,
      chatflowId: 'cf-1',
      strategy: 'regex',
      predictFn: async () => '42',
    })

    expect(run.results[0]?.passed).toBe(true)
  })

  it('marks run as failed if predictFn throws', async () => {
    const ds = createDataset({
      name: 'Fail',
      items: [{ input: 'q', expectedOutput: 'a' }],
    })

    await expect(
      runEvaluation({
        datasetId: ds.id,
        chatflowId: 'cf-1',
        predictFn: async () => {
          throw new Error('LLM is down')
        },
      }),
    ).rejects.toThrow('LLM is down')
  })

  it('handles empty dataset', async () => {
    const ds = createDataset({ name: 'Empty' })
    const run = await runEvaluation({
      datasetId: ds.id,
      chatflowId: 'cf-1',
      predictFn: async () => '',
    })
    expect(run.status).toBe('completed')
    expect(run.results).toHaveLength(0)
    expect(run.summary.total).toBe(0)
    expect(run.summary.avgLatencyMs).toBe(0)
  })
})
