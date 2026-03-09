import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetDatasets,
  addDatasetItems,
  createDataset,
  deleteDataset,
  getAllDatasets,
  getDataset,
} from '../src/storage/datasetStore.js'

afterEach(() => _resetDatasets())

describe('datasetStore', () => {
  it('creates a dataset with defaults', () => {
    const ds = createDataset({ name: 'Test DS' })
    expect(ds.id).toBeTruthy()
    expect(ds.name).toBe('Test DS')
    expect(ds.description).toBe('')
    expect(ds.items).toEqual([])
    expect(ds.createdDate).toBeTruthy()
  })

  it('creates a dataset with items', () => {
    const ds = createDataset({
      name: 'With Items',
      description: 'A desc',
      items: [{ input: 'hi', expectedOutput: 'hello' }],
    })
    expect(ds.items).toHaveLength(1)
    expect(ds.description).toBe('A desc')
  })

  it('lists all datasets', () => {
    createDataset({ name: 'A' })
    createDataset({ name: 'B' })
    expect(getAllDatasets()).toHaveLength(2)
  })

  it('gets a dataset by id', () => {
    const ds = createDataset({ name: 'Find Me' })
    expect(getDataset(ds.id)).toEqual(ds)
    expect(getDataset('nonexistent')).toBeUndefined()
  })

  it('adds items to an existing dataset', () => {
    const ds = createDataset({ name: 'DS' })
    const updated = addDatasetItems(ds.id, [
      { input: 'q1', expectedOutput: 'a1' },
      { input: 'q2', expectedOutput: 'a2' },
    ])
    expect(updated?.items).toHaveLength(2)
    // updatedDate should be >= createdDate (may be same ms)
    expect(new Date(updated?.updatedDate ?? 0).getTime()).toBeGreaterThanOrEqual(new Date(ds.createdDate).getTime())
  })

  it('returns undefined when adding items to nonexistent dataset', () => {
    expect(addDatasetItems('nope', [{ input: 'q', expectedOutput: 'a' }])).toBeUndefined()
  })

  it('deletes a dataset', () => {
    const ds = createDataset({ name: 'Delete Me' })
    expect(deleteDataset(ds.id)).toBe(true)
    expect(getDataset(ds.id)).toBeUndefined()
    expect(deleteDataset(ds.id)).toBe(false)
  })

  it('reset clears all datasets', () => {
    createDataset({ name: 'A' })
    createDataset({ name: 'B' })
    _resetDatasets()
    expect(getAllDatasets()).toHaveLength(0)
  })
})
