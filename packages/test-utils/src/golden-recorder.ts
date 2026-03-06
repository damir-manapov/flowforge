import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { normalize } from './normalize.js'

export class GoldenRecorder {
  private readonly baseDir: string

  constructor(goldensDir: string, targetName: string) {
    this.baseDir = join(goldensDir, targetName)
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true })
    }
  }

  record(testName: string, data: unknown): void {
    const normalized = normalize(data)
    const filePath = join(this.baseDir, `${testName}.json`)
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf-8')
  }

  load(testName: string): unknown | undefined {
    const filePath = join(this.baseDir, `${testName}.json`)
    if (!existsSync(filePath)) {
      return undefined
    }
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as unknown
  }
}
