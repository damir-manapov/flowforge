import { basename } from 'node:path'

const UNSAFE_FILENAME_RE = /[/\\:*?"<>|]/g

/** Strip path traversal and control characters from user-supplied filenames */
export function sanitizeFilename(raw: string): string {
  const base = basename(raw)
  const cleaned = base.replace(UNSAFE_FILENAME_RE, '_').slice(0, 255)
  return cleaned || 'unnamed'
}
