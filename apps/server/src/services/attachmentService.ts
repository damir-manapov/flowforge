import { v4 as uuidv4 } from 'uuid'
import { sanitizeFilename } from '../utils/sanitize.js'

export { sanitizeFilename } from '../utils/sanitize.js'

export interface UploadedFile {
  name: string
  size: number
  type: string
  id: string
}

export function buildUploadedFile(filename: string, size: number, mimetype: string): UploadedFile {
  return {
    name: sanitizeFilename(filename),
    size,
    type: mimetype,
    id: uuidv4(),
  }
}
