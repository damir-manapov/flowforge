import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tempDirs: string[] = []

export function createTempDir(prefix = 'flowforge-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

export function createTempFile(content: string | Buffer, filename = 'test-file.txt'): string {
  const dir = createTempDir()
  const filePath = join(dir, filename)
  if (typeof content === 'string') {
    writeFileSync(filePath, content, 'utf-8')
  } else {
    writeFileSync(filePath, content)
  }
  return filePath
}

export function cleanupTemp(): void {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
  tempDirs.length = 0
}
