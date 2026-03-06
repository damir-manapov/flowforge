import { basename } from 'node:path'
import { v4 as uuidv4 } from 'uuid'

export interface UploadedFile {
  name: string
  size: number
  type: string
  id: string
}

export interface AttachmentResult {
  chatflowId: string
  chatId: string
  files: UploadedFile[]
}

const UNSAFE_FILENAME_RE = /[/\\:*?"<>|]/g

/** Strip path traversal and control characters from user-supplied filenames */
export function sanitizeFilename(raw: string): string {
  const base = basename(raw)
  const cleaned = base.replace(UNSAFE_FILENAME_RE, '_').slice(0, 255)
  return cleaned || 'unnamed'
}

export function buildUploadedFile(filename: string, size: number, mimetype: string): UploadedFile {
  return {
    name: sanitizeFilename(filename),
    size,
    type: mimetype,
    id: uuidv4(),
  }
}
